import { PROVIDERS, getBaseUrl, getDefaultBaseUrl } from './apiProviders'
import { sendHordeNativeChatCompletion } from './hordeNativeApi'
import {
  getSetting,
  normalizeSectionHeader,
  DEFAULT_PERSONAS_HISTORY_TEMPLATE,
  DEFAULT_PERSONAS_HISTORY_ENTRY_TEMPLATE,
} from './settings'
import { getThread } from './threads'
import { getWritingInstruction } from './writingInstructions'
import { buildInjectedMemory } from './threadMemories'
import { resolveScenarioInjection, resolveGlobalContextInjection } from './scenarios'
import { getEffectiveStatusBlock } from './statusBlocks'
import { getPersona } from './personas'
import { parseBundleEntries } from './chatGeneration'
import { getActiveLoreBlocks } from './lorebookActivation'

// A message is hidden for payload purposes when its currently-active slot
// entry carries `hidden: true`. Visibility is stored per-slot (each entry in
// `bundleMessages`), but only the active slot's flag affects API requests.
export function isMessageHidden(message) {
  const entries = parseBundleEntries(message?.bundleMessages)
  if (!entries) return false
  const idx = message?.activeSlotIndex ?? 0
  const entry = entries[idx] ?? entries[0]
  return entry?.hidden === true
}

// A message is an initial (greeting) message when every bundle slot carries
// `origin: 'initial'`. Mirrors the INI-flag convention in computeMessageFlags.
export function isInitialMessage(message) {
  const entries = parseBundleEntries(message?.bundleMessages)
  return (
    Array.isArray(entries) && entries.length > 0 && entries.every((e) => e.origin === 'initial')
  )
}

function extractErrorDetail(errBody) {
  if (!errBody) return ''
  try {
    const parsed = JSON.parse(errBody)
    if (typeof parsed === 'string') return parsed
    if (parsed.error) {
      if (typeof parsed.error === 'string') return parsed.error
      if (parsed.error.message) return parsed.error.message
    }
  } catch {
    return errBody
  }
  return errBody
}

export function replaceVars(text, { charName, personaName, currentPersonaName }) {
  if (!text) return text
  return text
    .replace(/{{char}}/gi, charName || '')
    .replace(/{{user}}/gi, personaName || '')
    .replace(/{{name}}/gi, currentPersonaName || personaName || '')
}

// Resolves {{char}}/{{user}}/{{name}} inside activated lorebook content blocks
// before they are injected. The named slots are joined strings of entry
// contents; atDepth is a Map of depth -> joined contents.
function resolveLoreVars(loreBlocks, replaceVarsIn) {
  if (!loreBlocks) return loreBlocks
  return {
    ...loreBlocks,
    beforeChar: replaceVarsIn(loreBlocks.beforeChar),
    afterChar: replaceVarsIn(loreBlocks.afterChar),
    beforePrompt: replaceVarsIn(loreBlocks.beforePrompt),
    afterPrompt: replaceVarsIn(loreBlocks.afterPrompt),
    atDepth:
      loreBlocks.atDepth instanceof Map
        ? new Map([...loreBlocks.atDepth.entries()].map(([d, text]) => [d, replaceVarsIn(text)]))
        : loreBlocks.atDepth,
  }
}

// Prefixes a content block with its section header on its own line. When the
// header's toggle is enabled the header is separated from the content by a
// blank line; otherwise by a single newline.
function applySectionHeader(header, content, replaceVarsIn) {
  if (!content || !header?.value) return content
  const headerText = replaceVarsIn ? replaceVarsIn(header.value) : header.value
  return `${headerText}${header.enabled ? '\n\n' : '\n'}${content}`
}

// Substitutes persona description tokens in addition to the base {{char}}/{{user}}/{{name}}
// variables. Token semantics:
//   {{description}}        -> the active user persona in the current chat (currentPersona)
//   {{description_chat}}   -> the persona that started the chat (chatPersona, from thread.personaId)
//   {{description_default}}-> the global default user persona (defaultPersonaId setting)
export function replacePersonaTemplate(
  text,
  {
    charName,
    personaName,
    currentPersonaName,
    currentPersona,
    chatPersona,
    defaultPersona,
    personasHistory = '',
  },
) {
  if (!text) return text
  const resolved = replaceVars(text, { charName, personaName, currentPersonaName })
  const desc = currentPersona?.description || ''
  const descChat = chatPersona?.description || ''
  const descDefault = defaultPersona?.description || ''
  return resolved
    .replace(/{{description}}/gi, desc)
    .replace(/{{description_chat}}/gi, descChat)
    .replace(/{{description_default}}/gi, descDefault)
    .replace(/{{personas_history}}/gi, personasHistory)
}

// Builds the {{personas_history}} block: the persona that started the chat
// (chatPersona, from thread.personaId) always participates, even before it has
// sent any messages — so the token resolves on the very first message and on
// regeneration of it. Message-derived personas are appended and deduped by id.
//
// The block layout is customizable via settings:
//   template      — wrapper that receives the joined entry lines via
//                   {{personas_entries}}; standard {{char}}/{{user}}/{{name}}/
//                   {{description}}/{{description_chat}}/{{description_default}}
//                   resolve to the global values.
//   entryTemplate — per-persona format using {{name}} and {{description}}. When
//                   a persona has no description and the default entry template
//                   is used, it falls back to a name-only line.
export function buildPersonasHistory(
  messages,
  {
    chatPersona,
    personaMap,
    template = DEFAULT_PERSONAS_HISTORY_TEMPLATE,
    entryTemplate = DEFAULT_PERSONAS_HISTORY_ENTRY_TEMPLATE,
    charName = '',
    personaName = '',
    currentPersonaName = '',
    currentPersona = null,
    defaultPersona = null,
  } = {},
) {
  const seen = new Set()
  const entries = []
  const push = (p) => {
    if (!p) return
    if (p.id != null && seen.has(p.id)) return
    if (p.id != null) seen.add(p.id)
    const desc = p.description
    const useFallback = !desc && entryTemplate === DEFAULT_PERSONAS_HISTORY_ENTRY_TEMPLATE
    entries.push(
      useFallback
        ? `- ${p.name}`
        : entryTemplate
            .replace(/{{name}}/gi, p.name || '')
            .replace(/{{description}}/gi, desc || ''),
    )
  }
  push(chatPersona)
  for (const m of messages || []) {
    push(m?.personaId ? personaMap?.[m.personaId] : null)
  }
  if (entries.length === 0) return ''

  let block = replaceVars(template || '', { charName, personaName, currentPersonaName })
  block = block
    .replace(/{{description}}/gi, currentPersona?.description || '')
    .replace(/{{description_chat}}/gi, chatPersona?.description || '')
    .replace(/{{description_default}}/gi, defaultPersona?.description || '')
  return block.replace(/{{personas_entries}}/gi, entries.join('\n'))
}

// Strips the configured OOC delimiters from message content when the
// "Use OOC Delimiters" setting is enabled and at least one delimiter value is
// non-empty. Removes a leading prefix and/or trailing suffix only when they
// exactly match the configured delimiters. Returns the content unchanged
// otherwise.
export function stripOOCDelimiters(content, delimiters) {
  if (!delimiters?.enabled) return content
  const left = delimiters.left || ''
  const right = delimiters.right || ''
  if (!left && !right) return content
  if (!content) return content
  let result = content
  if (left && result.startsWith(left)) {
    result = result.slice(left.length)
  }
  if (right && result.endsWith(right)) {
    result = result.slice(0, -right.length)
  }
  return result
}

// Wraps OOC message content with the configured delimiters when the
// "Use OOC Delimiters" setting is enabled and at least one delimiter value is
// non-empty. Strips any existing delimiters first to avoid double-wrapping.
// Returns the content unchanged otherwise.
function applyOOCDelimiters(content, delimiters) {
  if (!delimiters?.enabled) return content
  const left = delimiters.left || ''
  const right = delimiters.right || ''
  if (!left && !right) return content
  const stripped = stripOOCDelimiters(content, delimiters)
  return `${left}${stripped ?? ''}${right}`
}

export function getMessagesForApiRequest(
  messages,
  { includeOOC = true, keepMessages = 0, keptConsumedCount = 0 } = {},
) {
  if (!Array.isArray(messages)) return []

  const eligible = messages.filter(
    (message) =>
      !message?.isSummaryMarker &&
      !message?.isAutoTitleMarker &&
      !isMessageHidden(message) &&
      (includeOOC || !message?.isOOC || !isMessageHidden(message)),
  )
  if (keepMessages <= 0) {
    return eligible.filter((message) => !message?.summarizedAt)
  }

  let maxTs = null
  for (const m of eligible) {
    if (m?.summarizedAt) {
      const ts = new Date(m.summarizedAt).getTime()
      if (maxTs === null || ts > maxTs) maxTs = ts
    }
  }

  const keptIds = new Set()
  if (maxTs !== null) {
    const block = eligible.filter(
      (m) => m?.summarizedAt && new Date(m.summarizedAt).getTime() === maxTs,
    )
    const kept = block.slice(-keepMessages)
    kept.forEach((m) => keptIds.add(m.id))

    if (keptConsumedCount > 0) {
      const rolledOut = kept.slice(0, Math.min(keptConsumedCount, kept.length))
      rolledOut.forEach((m) => keptIds.delete(m.id))
    }
  }

  return eligible.filter((m) => !m.summarizedAt || keptIds.has(m.id))
}

const CODE_BLOCK_RE = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g
const CODE_BLOCK_TEST_RE = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/

function hasCodeBlocks(text) {
  return typeof text === 'string' && CODE_BLOCK_TEST_RE.test(text)
}

function stripCodeBlocks(text) {
  if (!text) return text
  return text.replace(CODE_BLOCK_RE, '').trim()
}

const MD_IMAGE_RE = /\[!\[.*?\]\(.*?\)\]\(.*?\)|!\[.*?\]\(.*?\)/g

function stripMarkdownImages(text) {
  if (!text) return text
  return text.replace(MD_IMAGE_RE, '').trim()
}

export function removeMarkdownImagesFromMessages(messages) {
  if (!Array.isArray(messages)) return messages
  return messages.map((msg) => {
    if (!msg.content) return msg
    return { ...msg, content: stripMarkdownImages(msg.content) }
  })
}

export function removeCodeBlocksFromMessages(messages, keepCodeBlocks) {
  if (!Array.isArray(messages) || keepCodeBlocks === 'always') return messages

  const keepCount = keepCodeBlocks === 'never' ? 0 : Number(keepCodeBlocks)

  // Only messages that actually contain code blocks and are user/assistant
  // roles consume the "keep" budget. Slots without code blocks don't move
  // the counter, so the cap targets the most recent code-bearing messages.
  // Count total code-bearing messages first, then strip the oldest ones
  // beyond the keep budget (keeping the LAST N).
  const codeBearingIndexes = messages.reduce((acc, msg, i) => {
    if ((msg.role === 'user' || msg.role === 'assistant') && hasCodeBlocks(msg.content)) {
      acc.push(i)
    }
    return acc
  }, [])

  const totalCount = codeBearingIndexes.length
  const stripBefore = Math.max(0, totalCount - keepCount)

  const stripFlags = messages.map(() => false)
  codeBearingIndexes.forEach((idx, positionFromOldest) => {
    stripFlags[idx] = positionFromOldest < stripBefore
  })

  return messages.map((msg, i) => {
    if (!stripFlags[i]) return msg
    return { ...msg, content: stripCodeBlocks(msg.content) }
  })
}

export function appendMemoryToPayload(payload, memoryText, memoryHeader) {
  if (!Array.isArray(payload) || payload.length === 0) return payload
  if (!memoryText) return payload

  const systemEntry = payload.find((entry) => entry?.role === 'system')
  if (!systemEntry) return payload

  const section = memoryHeader ? `${memoryHeader}\n\n${memoryText}` : memoryText
  const content = `${systemEntry.content || ''}${systemEntry.content ? '\n\n' : ''}${section}`

  return payload.map((entry) => (entry === systemEntry ? { ...entry, content } : entry))
}

// Assembles the character-prompt block for a request: the Character Prompt,
// followed (in modal order) by Personality, Status Block and Global
// Context/Scenario — each separated by one blank line and only when non-empty
// — then the active scenario appended last. All text is var-substituted by
// `replaceVarsIn`. Returns '' when the Character Prompt itself is empty (so
// personality and global context only inject wherever the Character Prompt
// would).
function buildCharacterPromptBlock(
  character,
  { isScenarioFirstMessage, lastSummarizationAt, activeScenario, statusBlock, replaceVarsIn },
) {
  const prompt = replaceVarsIn(character?.prompt)
  if (!prompt) return ''

  const parts = [prompt]

  const personality = replaceVarsIn(character?.personality)
  if (personality) parts.push(personality)

  const resolvedStatusBlock = replaceVarsIn(statusBlock)
  if (resolvedStatusBlock) parts.push(resolvedStatusBlock)

  const globalContextRaw = resolveGlobalContextInjection(character, {
    isFirstMessage: isScenarioFirstMessage,
    lastSummarizationAt,
  })
  if (globalContextRaw) parts.push(replaceVarsIn(globalContextRaw))

  let block = parts.join('\n\n')

  const rawScenarioText = resolveScenarioInjection(character, {
    isFirstMessage: isScenarioFirstMessage,
    lastSummarizationAt,
    activeScenario,
  })
  const scenarioText = rawScenarioText ? replaceVarsIn(rawScenarioText) : ''
  if (scenarioText) block = `${block}\n\n${scenarioText}`

  return block
}

export async function buildMessagesPayload({
  character,
  chatPersona,
  currentPersona,
  messages,
  isFirstMessage,
  isThreadStart,
  settings,
  writingInstruction,
  memoryText,
  memoryHeader,
  personaMap,
  lastSummarizationAt = null,
  activeScenario = null,
  statusBlock = null,
  loreBlocks = {
    beforeChar: '',
    afterChar: '',
    beforePrompt: '',
    afterPrompt: '',
    atDepth: new Map(),
  },
}) {
  const writingMessageRole =
    character?.writingMessageRole || settings.writingMessageRole || 'system'
  const personaInjectionMessageRole =
    character?.personaInjectionMessageRole || settings.personaInjectionMessageRole || 'system'
  const systemParts = []

  const charName = character?.name || ''
  const personaName = chatPersona?.name || ''
  const currentPersonaName = currentPersona?.name || personaName

  const defaultPersonaId = await getSetting('defaultPersonaId')
  const defaultPersona = defaultPersonaId ? await getPersona(defaultPersonaId) : null

  const replaceVarsIn = (text) => replaceVars(text, { charName, personaName, currentPersonaName })
  loreBlocks = resolveLoreVars(loreBlocks, replaceVarsIn)

  const usedPersonaIds = [...new Set(messages.map((m) => m.personaId).filter(Boolean))]
  const personasHistory = buildPersonasHistory(messages, {
    chatPersona,
    personaMap,
    template: settings.personasHistoryTemplate,
    entryTemplate: settings.personasHistoryEntryTemplate,
    charName,
    personaName,
    currentPersonaName,
    currentPersona,
    defaultPersona,
  })

  const replaceVarsWithDesc = (text) =>
    replacePersonaTemplate(text, {
      charName,
      personaName,
      currentPersonaName,
      currentPersona,
      chatPersona,
      defaultPersona,
      personasHistory,
    })

  const prefixAssistant = await getSetting('prompting.prefixAssistantRole')
  const prefixUser = await getSetting('prompting.prefixUserRole')
  const assistantPrefix =
    prefixAssistant?.enabled && prefixAssistant.value ? replaceVarsIn(prefixAssistant.value) : ''
  const userPrefix = prefixUser?.enabled && prefixUser.value ? replaceVarsIn(prefixUser.value) : ''

  const userRolePrefixWithPersona = await getSetting('prompting.userRolePrefixWithPersona')
  const userPersonaPrefixOverride = character?.userPersonaPrefix === false ? false : true
  const oocDelimiters = await getSetting('prompting.oocDelimiters')

  const systemPrompt = replaceVarsIn(character?.systemPrompt)
  if (systemPrompt) {
    systemParts.push(systemPrompt)
  }

  // When the Character Prompt is empty, Status Block is placed right after the
  // SYSTEM Prompt instead of inside the character-prompt block.
  if (!character?.prompt?.trim()) {
    const resolvedStatusBlock = replaceVarsIn(statusBlock)
    if (resolvedStatusBlock) systemParts.push(resolvedStatusBlock)
  }

  if (loreBlocks.beforeChar) {
    systemParts.push(
      applySectionHeader(settings.loreContextHeader, loreBlocks.beforeChar, replaceVarsIn),
    )
  }

  const personaTiming = character?.personaInjectionTiming || settings.personaInjectionTiming
  const personaPlacement =
    character?.personaInjectionPlacement || settings.personaInjectionPlacement
  const rawPersonaTemplate = settings.personaInjectionTemplate
  const personaTemplate = replaceVarsWithDesc(rawPersonaTemplate)

  if (personaTiming !== 'never' && personaTemplate && personaPlacement === 'endOfSystemPrompt') {
    let injected = personaTemplate
    if (usedPersonaIds.length > 1 && !rawPersonaTemplate.includes('{{personas_history}}')) {
      injected += '\n\n' + personasHistory
    }
    systemParts.push(injected)
  }

  const promptBlock = buildCharacterPromptBlock(character, {
    isScenarioFirstMessage: isThreadStart ?? isFirstMessage,
    lastSummarizationAt,
    activeScenario,
    statusBlock,
    replaceVarsIn,
  })
  if (promptBlock) {
    systemParts.push(promptBlock)
  }

  if (personaTiming !== 'never' && personaTemplate && personaPlacement === 'endOfCharacterPrompt') {
    let injected = personaTemplate
    if (usedPersonaIds.length > 1 && !rawPersonaTemplate.includes('{{personas_history}}')) {
      injected += '\n\n' + personasHistory
    }
    systemParts.push(injected)
  }

  if (loreBlocks.afterChar) {
    systemParts.push(
      applySectionHeader(settings.loreContextHeader, loreBlocks.afterChar, replaceVarsIn),
    )
  }

  const writingTiming = character?.writingInjectionTiming || settings.writingInjectionTiming
  const writingPlacement = character?.writingPlacement || settings.writingPlacement
  if (
    writingInstruction?.content &&
    writingTiming === 'always' &&
    writingPlacement === 'endOfSystemPrompt'
  ) {
    const wiContent = replaceVarsIn(writingInstruction.content)
    const wiHeader = settings.writingInstructionHeader
    systemParts.push(
      wiHeader.value
        ? `${replaceVarsIn(wiHeader.value)}${wiHeader.enabled ? '\n\n' : '\n'}${wiContent}`
        : wiContent,
    )
  }

  const extraPrompt = replaceVarsIn(character?.extraPrompt)
  const hasInitialMessages = messages.some(isInitialMessage)
  const hasRealReply = messages.some((m) => !isInitialMessage(m) && m.role === 'assistant')
  if ((isFirstMessage || (hasInitialMessages && !hasRealReply)) && extraPrompt) {
    systemParts.push(extraPrompt)
  }

  const result = [{ role: 'system', content: systemParts.join('\n\n') }]
  const entryTypes = ['system']

  const postHistoryInstructions = replaceVarsWithDesc(character?.postHistoryInstructions)

  if (isFirstMessage) {
    if (loreBlocks.beforePrompt) {
      result.push({
        role: 'user',
        content: applySectionHeader(
          settings.loreContextHeader,
          loreBlocks.beforePrompt,
          replaceVarsIn,
        ),
      })
      entryTypes.push('loreBeforePrompt')
    }
    const firstMessageContent = replaceVarsIn(settings.firstMessagePrompt)
    const firstMessageRole = settings.firstMessageRole || 'system'
    if (firstMessageContent) {
      if (postHistoryInstructions) {
        result.push({
          role: firstMessageRole,
          content: firstMessageContent + '\n\n' + postHistoryInstructions,
        })
      } else {
        result.push({ role: firstMessageRole, content: firstMessageContent })
      }
      entryTypes.push('firstMessage')
    }
    if (loreBlocks.afterPrompt) {
      result.push({
        role: 'user',
        content: applySectionHeader(
          settings.loreContextHeader,
          loreBlocks.afterPrompt,
          replaceVarsIn,
        ),
      })
      entryTypes.push('loreAfterPrompt')
    }
  } else {
    for (const msg of messages) {
      if (msg.isSummaryMarker || msg.isAutoTitleMarker) continue
      if (isMessageHidden(msg)) continue
      let content = msg.role === 'user' ? msg.content : replaceVarsIn(msg.content)
      if (!msg.isOOC) {
        if (msg.role === 'assistant' && assistantPrefix) {
          content = assistantPrefix + content
        } else if (msg.role === 'user') {
          if (userPersonaPrefixOverride && userRolePrefixWithPersona) {
            const pName = personaMap?.[msg.personaId]?.name || currentPersonaName || personaName
            let resolved = userRolePrefixWithPersona
              .replace(/{{name}}/gi, pName)
              .replace(/{{persona_name}}/gi, pName)
            resolved = replaceVarsWithDesc(resolved)
            if (resolved && !/\s$/.test(resolved)) resolved += '\n'
            content = resolved + content
          } else if (userPrefix) {
            content = userPrefix + content
          }
        }
      } else if (msg.isOOC) {
        content = applyOOCDelimiters(content, oocDelimiters)
      }
      result.push({ role: msg.role, content, personaId: msg.personaId })
      entryTypes.push('chatMessage')
    }

    const lastMsg = messages[messages.length - 1]
    const continuePrompt = replaceVarsIn(settings.continuePrompt)
    const continueRole = settings.continueRole || 'user'
    if (lastMsg && lastMsg.role !== 'user' && continuePrompt) {
      result.push({ role: continueRole, content: continuePrompt })
      entryTypes.push('continue')
    }
  }

  if (loreBlocks.atDepth instanceof Map && loreBlocks.atDepth.size > 0) {
    const depths = [...loreBlocks.atDepth.keys()].sort((a, b) => b - a)
    for (const depth of depths) {
      const text = applySectionHeader(
        settings.loreContextHeader,
        loreBlocks.atDepth.get(depth),
        replaceVarsIn,
      )
      if (!text) continue
      const insertIdx = Math.max(1, result.length - depth)
      result.splice(insertIdx, 0, { role: 'system', content: text })
      entryTypes.splice(insertIdx, 0, 'loreAtDepth')
    }
  }

  const writingEndOfMessages =
    writingInstruction?.content &&
    writingTiming === 'always' &&
    writingPlacement === 'endOfMessages'
  if (writingEndOfMessages) {
    const wiContent = replaceVarsIn(writingInstruction.content)
    const wiH = settings.writingInstructionHeader
    result.push({
      role: writingMessageRole,
      content: wiH.value
        ? `${replaceVarsIn(wiH.value)}${wiH.enabled ? '\n\n' : '\n'}${wiContent}`
        : wiContent,
    })
    entryTypes.push('writing')
  }

  const personaEndOfMessages =
    personaTiming !== 'never' && personaTemplate && personaPlacement === 'endOfMessages'
  if (personaEndOfMessages) {
    let content = personaTemplate
    if (usedPersonaIds.length > 1 && !rawPersonaTemplate.includes('{{personas_history}}')) {
      content += '\n\n' + personasHistory
    }
    result.push({ role: personaInjectionMessageRole, content })
    entryTypes.push('persona')
  }

  if (!isFirstMessage) {
    if (loreBlocks.beforePrompt) {
      result.push({
        role: 'user',
        content: applySectionHeader(
          settings.loreContextHeader,
          loreBlocks.beforePrompt,
          replaceVarsIn,
        ),
      })
      entryTypes.push('loreBeforePrompt')
    }
    if (postHistoryInstructions) {
      result.push({ role: 'user', content: postHistoryInstructions })
      entryTypes.push('postHistory')
    }
    if (loreBlocks.afterPrompt) {
      result.push({
        role: 'user',
        content: applySectionHeader(
          settings.loreContextHeader,
          loreBlocks.afterPrompt,
          replaceVarsIn,
        ),
      })
      entryTypes.push('loreAfterPrompt')
    }
  }

  if (memoryText) {
    return {
      payload: appendMemoryToPayload(result, memoryText, memoryHeader),
      entryTypes,
    }
  }

  return { payload: result, entryTypes }
}

export function getActiveParams(profile) {
  const providerDef = PROVIDERS.find((p) => p.id === profile.providerId)
  const hordeMethod =
    profile.providerId === 'ai-horde' ? profile.params?.hordeMethod || 'native' : null
  const deprecatedKeys = new Set(
    (providerDef?.params || []).filter((p) => p.deprecated).map((p) => p.key),
  )
  const disabledKeys = new Set(
    Object.entries(profile.disabledParams || {})
      .filter(([, v]) => v)
      .map(([k]) => k),
  )
  const active = Object.fromEntries(
    Object.entries(profile.params || {}).filter(([key]) => {
      if (key === 'hordeMethod' || key === 'hordeMethodTemplate') return false
      if (deprecatedKeys.has(key)) return false
      if (disabledKeys.has(key)) return false
      if (hordeMethod) {
        const paramDef = providerDef?.params?.find((p) => p.key === key)
        if (paramDef?.method && paramDef.method !== 'all' && paramDef.method !== hordeMethod) {
          return false
        }
      }
      return true
    }),
  )
  // Always send penalty params with their effective value (0 when unset) so a
  // profile explicitly configured to zero still passes 0 to the API — unless the
  // user explicitly disabled them.
  if (providerDef && hordeMethod !== 'native') {
    for (const key of ['frequency_penalty', 'presence_penalty']) {
      if (
        !disabledKeys.has(key) &&
        providerDef.params.some((p) => p.key === key) &&
        !(key in active)
      ) {
        active[key] = 0
      }
    }
  }
  // OpenAI-compatible reasoning params
  if (active.reasoning_effort != null) {
    active.reasoning_effort = String(active.reasoning_effort)
  }
  return active
}

export async function buildTranscript({
  messages,
  personaName,
  currentPersonaName,
  userPersonaPrefixOverride,
  personaMap,
  rolePrefixes,
  replaceVarsIn,
  replaceVarsWithDesc,
}) {
  const {
    systemRolePrefix,
    assistantRolePrefix,
    userRolePrefix,
    userRolePrefixWithPersona,
    systemRolePrefixOoc,
    assistantRolePrefixOoc,
    userRolePrefixOoc,
  } = rolePrefixes

  const oocDelimiters = await getSetting('prompting.oocDelimiters')

  const lines = []

  for (const msg of messages) {
    if (msg.isSummaryMarker || msg.isAutoTitleMarker) continue
    if (isMessageHidden(msg)) continue

    let prefix = ''

    if (msg.isOOC) {
      switch (msg.role) {
        case 'system':
          prefix = systemRolePrefixOoc || '[SYSTEM in OOC]:'
          break
        case 'assistant':
          prefix = assistantRolePrefixOoc || '[ASSISTANT in OOC]:'
          break
        case 'user':
          prefix = userRolePrefixOoc || '[USER in OOC]:'
          break
      }
    } else {
      switch (msg.role) {
        case 'system':
          prefix = systemRolePrefix || '[SYSTEM]:'
          break
        case 'assistant':
          prefix = assistantRolePrefix || '[ASSISTANT]:'
          break
        case 'user':
          if (userPersonaPrefixOverride && msg.personaId) {
            const pName = personaMap?.[msg.personaId]?.name || currentPersonaName || personaName
            prefix = (userRolePrefixWithPersona || '[USER as {{name}}]:')
              .replace(/{{name}}/gi, pName)
              .replace(/{{persona_name}}/gi, pName)
          } else {
            prefix = userRolePrefix || '[USER]:'
          }
          break
      }
    }

    const resolvePrefix = replaceVarsWithDesc || replaceVarsIn
    if (resolvePrefix && prefix) {
      prefix = resolvePrefix(prefix)
    }

    if (prefix && !/\s$/.test(prefix)) prefix += '\n'

    let content = msg.content || ''
    if (msg.isOOC) {
      content = applyOOCDelimiters(content, oocDelimiters)
    }
    lines.push(prefix + content)
  }

  return lines.join('\n\n')
}

// Returns the content of the last (newest) non-OOC user chat message from the
// API-call payload. Payload chat entries are pushed in `apiMessages` order, so
// a forward scan maps each entry typed 'chatMessage' back to its source message
// reliably — even when synthetic entries (lore, prompts) are interleaved. The
// content is taken from the payload entry (prefixes applied), matching what the
// model actually saw in the request.
export function getLastNonOocUserMessageContent(payload, entryTypes, apiMessages) {
  if (!Array.isArray(payload) || !Array.isArray(entryTypes)) return ''
  const sources = new Array(payload.length).fill(null)
  let chatIdx = 0
  for (let i = 0; i < payload.length; i++) {
    if (entryTypes[i] === 'chatMessage') {
      sources[i] = apiMessages?.[chatIdx] || null
      chatIdx++
    }
  }
  for (let i = payload.length - 1; i >= 0; i--) {
    if (payload[i]?.role !== 'user') continue
    if (entryTypes[i] !== 'chatMessage') continue
    const src = sources[i]
    if (!src || src.isOOC || isMessageHidden(src)) continue
    return payload[i].content || ''
  }
  return ''
}

// Builds a `(count) => Promise<string>` resolver for the {{messages_N}} director
// template. The current assistant response anchors the window: it is appended as
// the newest message so {{messages_N}} always ends where {{message_response}}
// resolves to (buildTranscript adds the assistant role prefix, matching the
// prefixed response). The window is sliced to the last `count` messages in
// chronological order — identical in format to {{transcript}}, stopping at the
// oldest message when the history is shorter than `count`.
export async function buildMessagesWindowTranscript({
  baseMessages,
  responseContent,
  character,
  chatPersona,
  currentPersona,
  personaMap,
}) {
  const charName = character?.name || ''
  const personaName = chatPersona?.name || ''
  const currentPersonaName = currentPersona?.name || personaName
  const replaceVarsIn = (text) => replaceVars(text, { charName, personaName, currentPersonaName })

  const defaultPersonaId = await getSetting('defaultPersonaId')
  const defaultPersona = defaultPersonaId ? await getPersona(defaultPersonaId) : null
  const personasHistory = buildPersonasHistory(baseMessages, {
    chatPersona,
    personaMap,
    template: await getSetting('prompting.personasHistoryTemplate'),
    entryTemplate: await getSetting('prompting.personasHistoryEntryTemplate'),
    charName,
    personaName,
    currentPersonaName,
    currentPersona,
    defaultPersona,
  })

  const replaceVarsWithDesc = (text) =>
    replacePersonaTemplate(text, {
      charName,
      personaName,
      currentPersonaName,
      currentPersona,
      chatPersona,
      defaultPersona,
      personasHistory,
    })

  const userPersonaPrefixOverride = character?.userPersonaPrefix === false ? false : true

  const rolePrefixes = {
    systemRolePrefix: await getSetting('prompting.systemRolePrefix'),
    assistantRolePrefix: await getSetting('prompting.assistantRolePrefix'),
    userRolePrefix: await getSetting('prompting.userRolePrefix'),
    userRolePrefixWithPersona: await getSetting('prompting.userRolePrefixWithPersona'),
    systemRolePrefixOoc: await getSetting('prompting.systemRolePrefixOoc'),
    assistantRolePrefixOoc: await getSetting('prompting.assistantRolePrefixOoc'),
    userRolePrefixOoc: await getSetting('prompting.userRolePrefixOoc'),
  }

  // Substitute {{char}}/{{user}}/{{name}} in non-user message content so the
  // window mirrors what the API payload contains (buildMessagesPayload runs
  // replaceVarsIn on every non-user message) — this is what makes templates
  // inside initial/greeting messages resolve. User content stays raw.
  const allMessages = [
    ...(Array.isArray(baseMessages) ? baseMessages : []).map((m) => {
      if (!m || m.role === 'user') return m
      return { ...m, content: replaceVarsIn(m.content) }
    }),
  ]
  if (responseContent) {
    allMessages.push({ role: 'assistant', content: responseContent })
  }

  return (count) => {
    const n = Number(count)
    if (!Number.isFinite(n) || n <= 0) return Promise.resolve('')
    const filtered = allMessages.filter(
      (m) => !m?.isSummaryMarker && !m?.isAutoTitleMarker && !isMessageHidden(m),
    )
    if (filtered.length === 0) return Promise.resolve('')
    const window = filtered.slice(-n)
    if (window.length === 0) return Promise.resolve('')
    return buildTranscript({
      messages: window,
      personaName,
      currentPersonaName,
      userPersonaPrefixOverride,
      personaMap,
      rolePrefixes,
      replaceVarsIn,
      replaceVarsWithDesc,
    })
  }
}

export async function prefixAssistantMessage(
  content,
  { charName, personaName, currentPersonaName } = {},
) {
  if (!content) return content
  const rawPrefix = (await getSetting('prompting.assistantRolePrefix')) || '[ASSISTANT]:'
  let prefix = replaceVars(rawPrefix, { charName, personaName, currentPersonaName })
  if (!prefix) return content
  if (!/\s$/.test(prefix)) prefix += '\n'
  return prefix + content
}

const DEFAULT_OOC_SYSTEM = [
  'This is an OOC (out-of-character) request. Respond only in OOC mode. Be concise, direct, pragmatic, and exact. Do not roleplay, narrate, or continue the story.',
  '{{system_prompt}}',
  '{{character_prompt}}',
  '{{status_block}}',
  '{{lore}}',
  '{{transcript}}',
  '{{memory}}',
].join('\n\n')

export async function buildOOCMessagesPayload({
  character,
  chatPersona,
  currentPersona,
  messages,
  oocSettings,
  userMessage,
  personaMap,
  memoryText,
  lastSummarizationAt = null,
  activeScenario = null,
  statusBlock = null,
  isFirstMessage = false,
  loreBlocks = {
    beforeChar: '',
    afterChar: '',
    beforePrompt: '',
    afterPrompt: '',
    atDepth: new Map(),
  },
}) {
  const charName = character?.name || ''
  const personaName = chatPersona?.name || ''
  const currentPersonaName = currentPersona?.name || personaName
  const replaceVarsIn = (text) => replaceVars(text, { charName, personaName, currentPersonaName })
  loreBlocks = resolveLoreVars(loreBlocks, replaceVarsIn)

  const defaultPersonaId = await getSetting('defaultPersonaId')
  const defaultPersona = defaultPersonaId ? await getPersona(defaultPersonaId) : null

  const personasHistory = buildPersonasHistory(messages, {
    chatPersona,
    personaMap,
    template: await getSetting('prompting.personasHistoryTemplate'),
    entryTemplate: await getSetting('prompting.personasHistoryEntryTemplate'),
    charName,
    personaName,
    currentPersonaName,
    currentPersona,
    defaultPersona,
  })

  const replaceVarsWithDesc = (text) =>
    replacePersonaTemplate(text, {
      charName,
      personaName,
      currentPersonaName,
      currentPersona,
      chatPersona,
      defaultPersona,
      personasHistory,
    })

  const oocSystemInstr = oocSettings.oocSystemInstructions
  const oocUserInstr = oocSettings.oocUserInstructions
  const userPersonaPrefixOverride = character?.userPersonaPrefix === false ? false : true

  // --- Pre-resolved context sections for the OOC templates ---

  const statusBlockResolved = replaceVarsIn(statusBlock)

  const systemPromptResolved = replaceVarsIn(character?.systemPrompt)

  // Character prompt section deliberately excludes the status block so that
  // {{character_prompt}} and {{status_block}} stay orthogonal.
  let promptSection = ''
  const prompt = replaceVarsIn(character?.prompt)
  if (prompt) {
    const parts = [prompt]
    const personality = replaceVarsIn(character?.personality)
    if (personality) parts.push(personality)
    const globalContextRaw = resolveGlobalContextInjection(character, {
      isFirstMessage,
      lastSummarizationAt,
    })
    if (globalContextRaw) parts.push(replaceVarsIn(globalContextRaw))
    promptSection = parts.join('\n\n')
    const rawScenarioText = resolveScenarioInjection(character, {
      isFirstMessage,
      lastSummarizationAt,
      activeScenario,
    })
    const scenarioText = rawScenarioText ? replaceVarsIn(rawScenarioText) : ''
    if (scenarioText) promptSection = `${promptSection}\n\n${scenarioText}`
  }
  const charPromptSection = (() => {
    if (!promptSection) return ''
    const cph = oocSettings.characterPromptHeader
    if (cph?.value) {
      return replaceVarsIn(cph.value) + (cph.enabled ? '\n\n' : '\n') + promptSection
    }
    return promptSection
  })()

  const loreParts = [loreBlocks.beforeChar, loreBlocks.afterChar]
  if (loreBlocks.atDepth instanceof Map) {
    for (const text of loreBlocks.atDepth.values()) {
      if (text) loreParts.push(text)
    }
  }
  loreParts.push(loreBlocks.beforePrompt, loreBlocks.afterPrompt)
  const loreJoined = loreParts.filter(Boolean).join('\n\n')
  const loreSection = loreJoined
    ? applySectionHeader(oocSettings.loreContextHeader, loreJoined, replaceVarsIn)
    : ''

  let transcriptWithVars = ''
  if (messages.length > 0) {
    const transcript = await buildTranscript({
      messages,
      personaName,
      currentPersonaName,
      userPersonaPrefixOverride,
      personaMap,
      rolePrefixes: {
        systemRolePrefix: oocSettings.systemRolePrefix,
        assistantRolePrefix: oocSettings.assistantRolePrefix,
        userRolePrefix: oocSettings.userRolePrefix,
        userRolePrefixWithPersona: oocSettings.userRolePrefixWithPersona,
        systemRolePrefixOoc: oocSettings.systemRolePrefixOoc,
        assistantRolePrefixOoc: oocSettings.assistantRolePrefixOoc,
        userRolePrefixOoc: oocSettings.userRolePrefixOoc,
      },
      replaceVarsWithDesc,
    })
    transcriptWithVars = replaceVarsIn(transcript)
  }
  const transcriptSection = (() => {
    if (!transcriptWithVars) return ''
    const mh = oocSettings.messagesHeader
    if (mh?.value) {
      return replaceVarsIn(mh.value) + (mh.enabled ? '\n\n' : '\n') + transcriptWithVars
    }
    return transcriptWithVars
  })()

  const memorySection = memoryText || ''

  const replaceOocTemplates = (text) =>
    replaceVarsWithDesc(text)
      .replace(/{{system_prompt}}/gi, systemPromptResolved)
      .replace(/{{character_prompt}}/gi, charPromptSection)
      .replace(/{{status_block}}/gi, statusBlockResolved)
      .replace(/{{lore}}/gi, loreSection)
      .replace(/{{transcript}}/gi, transcriptSection)
      .replace(/{{memory}}/gi, memorySection)
      // {{content}} resolves last so the user message is never re-parsed.
      .replace(/\{\{content\}\}/gi, userMessage || '')

  const collapseBlanks = (text) => text.replace(/\n{3,}/g, '\n\n')

  const defaultSystem = collapseBlanks(replaceOocTemplates(DEFAULT_OOC_SYSTEM))
  let systemContent = oocSystemInstr
    ? collapseBlanks(replaceOocTemplates(oocSystemInstr))
    : defaultSystem
  if (!systemContent.trim()) systemContent = defaultSystem

  const result = [{ role: 'system', content: systemContent }]
  const entryTypes = ['oocSystem']

  if (userMessage) {
    if (oocUserInstr) {
      const rawHasContent = /{{content}}/i.test(oocUserInstr)
      const rawHasTranscript = /{{transcript}}/i.test(oocUserInstr)
      let content = replaceOocTemplates(oocUserInstr)
      if (!rawHasContent && !rawHasTranscript) {
        content += '\n\n' + userMessage
      }
      result.push({ role: 'user', content })
    } else {
      result.push({ role: 'user', content: userMessage })
    }
    entryTypes.push('oocUser')
  }

  return { payload: result, entryTypes }
}

// Mirrors buildMsgNumbersArray formerly defined in ChatView: maps each payload
// entry back to the originating message number for prompt-data inspection.
export function buildMsgNumbersArray(isFirstMessage, apiMessages, currentMsgs, payload, isOOC) {
  let num = 0
  const numMap = new Map()
  for (const m of currentMsgs) {
    if (m.isSummaryMarker || m.isAutoTitleMarker) continue
    num++
    numMap.set(m.id, num)
  }
  const numbers = [null]
  if (isFirstMessage) {
    while (numbers.length < payload.length) {
      numbers.push(null)
    }
  } else if (isOOC) {
    // OOC payload entries are synthesized (SYSTEM from OOC instructions,
    // USER from the last user OOC message) and do not correspond
    // positionally to apiMessages. Map SYSTEM to null and USER to the
    // last user message number.
    let lastUserNum = null
    for (const m of currentMsgs) {
      if (m.isSummaryMarker || m.isAutoTitleMarker) continue
      if (m.role === 'user') lastUserNum = numMap.get(m.id) || null
    }
    numbers.push(lastUserNum)
    while (numbers.length < payload.length) {
      numbers.push(null)
    }
  } else {
    for (const msg of apiMessages) {
      numbers.push(numMap.get(msg.id) || null)
    }
    while (numbers.length < payload.length) {
      numbers.push(null)
    }
  }
  return numbers
}

export async function buildChatRequestPayload({
  character,
  chatPersona,
  currentPersona,
  messages,
  isFirstMessage,
  isThreadStart,
  isOOC,
  threadId,
  personaMap,
  beforeDate,
  statusBlock: statusBlockOverride,
}) {
  const includeOOC = character?.includeOOC !== false
  const keepMessages = Number(
    character?.messagesToKeep ?? (await getSetting('defaultMessagesToKeep')) ?? 0,
  )

  // During regeneration, clear summarization flags on messages summarized after
  // the message's position so getMessagesForApiRequest sees the original state.
  //
  const effectiveMessages = beforeDate
    ? messages.map((m) =>
        m.summarizedAt && new Date(m.summarizedAt) > beforeDate ? { ...m, summarizedAt: null } : m,
      )
    : messages

  let effectiveKeptConsumedCount = 0
  if (keepMessages > 0) {
    const rollover =
      character?.messageRollover ?? (await getSetting('defaultMessageRollover')) ?? 'rollover'
    if (rollover === 'rollover') {
      const latestThread = await getThread(threadId)
      effectiveKeptConsumedCount = Number(latestThread?.keptConsumedCount) || 0
    }
  }

  const apiMessages = getMessagesForApiRequest(effectiveMessages, {
    includeOOC,
    keepMessages,
    keptConsumedCount: effectiveKeptConsumedCount,
  })

  const keepCodeBlocks = await getSetting('prompting.keepCodeBlocks')
  let processedMessages = removeCodeBlocksFromMessages(apiMessages, keepCodeBlocks)

  if (character?.removeMarkdownImages !== false) {
    processedMessages = removeMarkdownImagesFromMessages(processedMessages)
  }

  const latestThread = await getThread(threadId)
  const memoryText = await buildInjectedMemory(character, latestThread, { beforeDate })
  const statusBlock =
    statusBlockOverride != null
      ? statusBlockOverride
      : getEffectiveStatusBlock(character, latestThread?.statusBlock)

  // During regeneration, roll the thread's lastSummarizationAt back to the
  // state at the regenerated message's position: a summary that happened after
  // `beforeDate` must not suppress firstSummary-lifetime injections. Mirrors
  // the per-message summarizedAt rollback above.
  const rawLastSummarizationAt = latestThread?.lastSummarizationAt || null
  const effectiveLastSummarizationAt =
    beforeDate && rawLastSummarizationAt && new Date(rawLastSummarizationAt) > beforeDate
      ? null
      : rawLastSummarizationAt

  // Include hidden messages (e.g. invisible OOC) in the lorebook scan
  // buffer so that their content can still trigger lorebook entries.
  const scanMessages = effectiveMessages.filter((m) => !m?.isSummaryMarker && !m?.isAutoTitleMarker)

  const loreBlocks = await getActiveLoreBlocks({
    character,
    messages: processedMessages,
    scanMessages,
  })

  let payload
  let entryTypes = null

  if (isOOC) {
    const oocSystemInstructions = await getSetting('prompting.oocSystem')
    const oocUserInstructions = await getSetting('prompting.oocUser')
    const characterPromptHeader = normalizeSectionHeader(
      await getSetting('prompting.apiRequestSectionHeaders.characterPrompt'),
    )
    const messagesHeader = normalizeSectionHeader(
      await getSetting('prompting.apiRequestSectionHeaders.messages'),
    )
    const loreContextHeader = normalizeSectionHeader(
      await getSetting('prompting.apiRequestSectionHeaders.loreContext'),
    )
    const systemRolePrefix = await getSetting('prompting.systemRolePrefix')
    const assistantRolePrefix = await getSetting('prompting.assistantRolePrefix')
    const userRolePrefix = await getSetting('prompting.userRolePrefix')
    const userRolePrefixWithPersona = await getSetting('prompting.userRolePrefixWithPersona')
    const systemRolePrefixOoc = await getSetting('prompting.systemRolePrefixOoc')
    const assistantRolePrefixOoc = await getSetting('prompting.assistantRolePrefixOoc')
    const userRolePrefixOoc = await getSetting('prompting.userRolePrefixOoc')

    const oocDelimiters = await getSetting('prompting.oocDelimiters')
    const lastUserMsg =
      messages.length > 0 && messages[messages.length - 1].role === 'user'
        ? stripOOCDelimiters(messages[messages.length - 1].content, oocDelimiters)
        : ''

    const oocMsg = effectiveMessages[effectiveMessages.length - 1]
    const transcriptMessages = processedMessages.filter((m) => m.id !== oocMsg.id)

    const oocResult = await buildOOCMessagesPayload({
      character,
      chatPersona,
      currentPersona,
      messages: transcriptMessages,
      userMessage: lastUserMsg,
      personaMap,
      memoryText,
      lastSummarizationAt: effectiveLastSummarizationAt,
      activeScenario: latestThread?.activeScenario || null,
      statusBlock,
      isFirstMessage,
      loreBlocks,
      oocSettings: {
        oocSystemInstructions,
        oocUserInstructions,
        characterPromptHeader,
        messagesHeader,
        loreContextHeader,
        systemRolePrefix,
        assistantRolePrefix,
        userRolePrefix,
        userRolePrefixWithPersona,
        systemRolePrefixOoc,
        assistantRolePrefixOoc,
        userRolePrefixOoc,
      },
    })
    payload = oocResult.payload
    entryTypes = oocResult.entryTypes
  } else {
    let writingInstruction = null
    if (character?.writingInstruction) {
      writingInstruction = await getWritingInstruction(Number(character.writingInstruction))
    }

    const settings = {
      firstMessageRole: await getSetting('prompting.firstMessageRole'),
      firstMessagePrompt: await getSetting('prompting.firstMessagePrompt'),
      continueRole: await getSetting('prompting.continueRole'),
      continuePrompt: await getSetting('prompting.continuePrompt'),
      personaInjectionTemplate: await getSetting('prompting.personaInjectionTemplate'),
      personasHistoryTemplate: await getSetting('prompting.personasHistoryTemplate'),
      personasHistoryEntryTemplate: await getSetting('prompting.personasHistoryEntryTemplate'),
      writingInjectionTiming: await getSetting('prompting.writingInjectionTiming'),
      writingPlacement: await getSetting('prompting.writingPlacement'),
      writingMessageRole: await getSetting('prompting.writingMessageRole'),
      writingInstructionHeader: normalizeSectionHeader(
        await getSetting('prompting.apiRequestSectionHeaders.writingInstruction'),
      ),
      loreContextHeader: normalizeSectionHeader(
        await getSetting('prompting.apiRequestSectionHeaders.loreContext'),
      ),
      personaInjectionTiming: await getSetting('prompting.personaInjectionTiming'),
      personaInjectionPlacement: await getSetting('prompting.personaInjectionPlacement'),
      personaInjectionMessageRole: await getSetting('prompting.personaInjectionMessageRole'),
    }

    if (character?.firstMessageRole) settings.firstMessageRole = character.firstMessageRole
    if (character?.firstMessagePrompt) settings.firstMessagePrompt = character.firstMessagePrompt
    if (character?.continueRole) settings.continueRole = character.continueRole
    if (character?.continuePrompt) settings.continuePrompt = character.continuePrompt

    const chatResult = await buildMessagesPayload({
      character,
      chatPersona,
      currentPersona,
      messages: processedMessages,
      isFirstMessage,
      isThreadStart,
      settings,
      writingInstruction,
      memoryText,
      memoryHeader: '',
      personaMap,
      lastSummarizationAt: effectiveLastSummarizationAt,
      activeScenario: latestThread?.activeScenario || null,
      statusBlock,
      loreBlocks,
    })
    payload = chatResult.payload
    entryTypes = chatResult.entryTypes
  }

  const msgNumbers = buildMsgNumbersArray(isFirstMessage, apiMessages, messages, payload, isOOC)

  return {
    payload,
    entryTypes,
    msgNumbers,
    messages: processedMessages,
    loreActivated: loreBlocks.activated || [],
    lorebooks: loreBlocks.lorebooks || [],
    loreTriggers: loreBlocks.loreTriggers,
  }
}

export async function sendChatCompletion({
  profile,
  messages,
  signal,
  onToken,
  onFinish,
  onStreamingStarted,
  onActivity,
  onTiming,
  onMeta,
  threadId = null,
  kind = null,
  charName,
  personaName,
  assistantSpeaker,
  personaMap,
}) {
  const isHordeNative =
    profile.providerId === 'ai-horde' &&
    (profile.params?.hordeMethod || 'openai-compatible') === 'native'

  if (isHordeNative) {
    return sendHordeNativeChatCompletion({
      profile,
      messages,
      signal,
      charName,
      personaName,
      assistantSpeaker,
      personaMap,
      onToken,
      onFinish,
      onStreamingStarted,
      onActivity,
      onTiming,
      onMeta,
      threadId,
      kind,
    })
  }

  let baseUrl = profile.baseUrl || null
  if (!baseUrl) {
    const rawUrl = await getBaseUrl(profile.providerId)
    if (rawUrl) {
      const stripped = rawUrl.replace(/\/+$/, '')
      baseUrl = stripped.endsWith('/v1') ? stripped : `${stripped}/v1`
    }
  }
  if (!baseUrl) {
    baseUrl = getDefaultBaseUrl(profile.providerId)
  }
  if (!baseUrl) throw new Error(`No base URL for provider "${profile.providerId}"`)

  const headers = { 'Content-Type': 'application/json' }
  if (profile.key) headers['Authorization'] = `Bearer ${profile.key}`

  const activeParams = getActiveParams(profile)

  const body = {
    model: profile.model,
    messages,
    ...activeParams,
  }

  const startedAt = performance.now()
  let timingReported = false
  const reportTiming = () => {
    if (timingReported) return
    timingReported = true
    onTiming?.(Math.round(performance.now() - startedAt))
  }

  let apiResponse = null
  let apiError = null
  let status = 'success'

  try {
    if (profile.params.stream) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        throw new Error(extractErrorDetail(errBody) || `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      let streamingStarted = false
      let respId = null
      let respObject = null
      let respCreated = null
      let respModel = null
      let lastUsage = null
      let finishReason = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const choice = parsed.choices?.[0]
            if (parsed.id && respId == null) {
              respId = parsed.id
              respObject = parsed.object
              respCreated = parsed.created
              respModel = parsed.model
            }
            if (parsed.usage) lastUsage = parsed.usage
            if (choice?.delta?.content) {
              if (!streamingStarted) {
                streamingStarted = true
                onStreamingStarted?.()
              }
              fullContent += choice.delta.content
              onActivity?.()
              onToken?.(fullContent)
            }
            if (choice?.finish_reason) {
              finishReason = choice.finish_reason
              onFinish?.(choice.finish_reason)
            }
          } catch {
            // TODO: Review this
            // skip unparseable chunks
          }
        }
      }

      // Flush: decode remaining bytes and process leftover buffer
      buffer += decoder.decode()
      if (buffer.trim()) {
        const line = buffer.trim()
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data)
              if (parsed.id && respId == null) {
                respId = parsed.id
                respObject = parsed.object
                respCreated = parsed.created
                respModel = parsed.model
              }
              if (parsed.usage) lastUsage = parsed.usage
              if (parsed.choices?.[0]?.delta?.content) {
                fullContent += parsed.choices[0].delta.content
                onActivity?.()
                onToken?.(fullContent)
              }
            } catch {
              /* skip */
            }
          }
        }
      }

      const response = {
        id: respId,
        object: respObject || 'chat.completion',
        created: respCreated,
        model: respModel || profile.model || null,
        choices: [
          {
            index: 0,
            finish_reason: finishReason,
            message: { role: 'assistant', content: fullContent },
          },
        ],
        usage: lastUsage || null,
      }

      apiResponse = response
      return { content: fullContent, response }
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(extractErrorDetail(errBody) || `HTTP ${res.status}`)
    }

    const json = await res.json()
    if (json.error) {
      const detail = typeof json.error === 'string' ? json.error : json.error.message || ''
      throw new Error(detail || 'Unknown API error')
    }
    const content = json.choices?.[0]?.message?.content || ''
    const finishReason = json.choices?.[0]?.finish_reason || null
    if (finishReason) onFinish?.(finishReason)
    apiResponse = json
    return { content, response: json }
  } catch (err) {
    apiError = err
    status = 'error'
    throw err
  } finally {
    reportTiming()
    const durationMs = Math.round(performance.now() - startedAt)
    import('../services/logs')
      .then(({ addLog }) =>
        addLog({
          type: 'api',
          threadId,
          kind,
          level: status === 'error' ? 'error' : 'info',
          providerId: profile.providerId,
          model: profile.model || null,
          request: body,
          response: apiResponse,
          status,
          durationMs,
          error: apiError ? apiError.message : null,
        }),
      )
      .catch(() => {})
  }
}
