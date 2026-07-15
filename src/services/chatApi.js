import { PROVIDERS, getBaseUrl } from './apiProviders'
import { getSetting } from './settings'
import { getThread } from './threads'
import { getWritingInstruction } from './writingInstructions'
import { buildInjectedMemory } from './threadMemories'

const BASE_URLS = {
  groq: 'https://api.groq.com/openai/v1',
  cerebras: 'https://api.cerebras.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  'ai-horde': 'https://oai.aihorde.net/v1',
}

export function getChatBaseUrl(providerId) {
  return BASE_URLS[providerId] || null
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

export function getMessagesForApiRequest(messages, { includeOOC = true, keepMessages = 0 } = {}) {
  if (!Array.isArray(messages)) return []

  const eligible = messages.filter(
    (message) =>
      !message?.isSummaryMarker && !message?.isAutoTitleMarker && (includeOOC || !message?.isOOC),
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
  }

  return eligible.filter((m) => !m.summarizedAt || keptIds.has(m.id))
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

export async function buildMessagesPayload({
  character,
  chatPersona,
  currentPersona,
  messages,
  isFirstMessage,
  settings,
  writingInstruction,
  memoryText,
  memoryHeader,
}) {
  const writingMessageRole =
    character?.writingMessageRole || settings.writingMessageRole || 'system'
  const personaInjectionMessageRole =
    character?.personaInjectionMessageRole || settings.personaInjectionMessageRole || 'system'
  const systemParts = []

  const charName = character?.name || ''
  const personaName = chatPersona?.name || ''
  const currentPersonaName = currentPersona?.name || personaName

  const replaceVarsIn = (text) => replaceVars(text, { charName, personaName, currentPersonaName })

  const replaceVarsWithDesc = (text) => {
    if (!text) return text
    const desc = currentPersona?.description || ''
    return replaceVarsIn(text).replace(/{{description}}/gi, desc)
  }

  const prefixAssistant = await getSetting('prompting.prefixAssistantRole')
  const prefixUser = await getSetting('prompting.prefixUserRole')
  const assistantPrefix =
    prefixAssistant?.enabled && prefixAssistant.value ? replaceVarsIn(prefixAssistant.value) : ''
  const userPrefix = prefixUser?.enabled && prefixUser.value ? replaceVarsIn(prefixUser.value) : ''

  const prompt = replaceVarsIn(character?.prompt)
  if (prompt) systemParts.push(prompt)

  const extraPrompt = replaceVarsIn(character?.extraPrompt)
  if (isFirstMessage && extraPrompt) systemParts.push(extraPrompt)

  const personaTiming = character?.personaInjectionTiming || settings.personaInjectionTiming
  const personaPlacement =
    character?.personaInjectionPlacement || settings.personaInjectionPlacement
  const personaTemplate = replaceVarsWithDesc(settings.personaInjectionTemplate)
  if (personaTiming !== 'never' && personaTemplate && personaPlacement === 'endOfSystemPrompt') {
    systemParts.push(personaTemplate)
  }

  const writingTiming = character?.writingInjectionTiming || settings.writingInjectionTiming
  const writingPlacement = character?.writingPlacement || settings.writingPlacement
  if (
    writingInstruction?.content &&
    writingTiming === 'always' &&
    writingPlacement === 'endOfSystemPrompt'
  ) {
    const wiContent = replaceVarsIn(writingInstruction.content)
    systemParts.push(
      settings.writingInstructionHeader
        ? `${replaceVarsIn(settings.writingInstructionHeader)}\n\n${wiContent}`
        : wiContent,
    )
  }

  const result = [{ role: 'system', content: systemParts.join('\n\n') }]
  const entryTypes = ['system']

  const postHistoryInstructions = replaceVarsWithDesc(character?.postHistoryInstructions)

  if (isFirstMessage) {
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
  } else {
    for (const msg of messages) {
      if (msg.isSummaryMarker || msg.isAutoTitleMarker) continue
      let content = replaceVarsIn(msg.content)
      if (!msg.isOOC) {
        if (msg.role === 'assistant' && assistantPrefix) {
          content = assistantPrefix + content
        } else if (msg.role === 'user' && userPrefix) {
          content = userPrefix + content
        }
      }
      result.push({ role: msg.role, content })
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

  const writingEndOfMessages =
    writingInstruction?.content &&
    writingTiming === 'always' &&
    writingPlacement === 'endOfMessages'
  if (writingEndOfMessages) {
    const wiContent = replaceVarsIn(writingInstruction.content)
    result.push({
      role: writingMessageRole,
      content: settings.writingInstructionHeader
        ? `${replaceVarsIn(settings.writingInstructionHeader)}\n\n${wiContent}`
        : wiContent,
    })
    entryTypes.push('writing')
  }

  const personaEndOfMessages =
    personaTiming !== 'never' && personaTemplate && personaPlacement === 'endOfMessages'
  if (personaEndOfMessages) {
    result.push({ role: personaInjectionMessageRole, content: personaTemplate })
    entryTypes.push('persona')
  }

  if (!isFirstMessage && postHistoryInstructions) {
    result.push({ role: 'user', content: postHistoryInstructions })
    entryTypes.push('postHistory')
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
  const deprecatedKeys = new Set(
    (providerDef?.params || []).filter((p) => p.deprecated).map((p) => p.key),
  )
  const active = Object.fromEntries(
    Object.entries(profile.params || {}).filter(
      ([key]) => !deprecatedKeys.has(key) && key !== 'hordeMethod',
    ),
  )
  // Always send penalty params with their effective value (0 when unset) so a
  // profile explicitly configured to zero still passes 0 to the API.
  if (providerDef) {
    for (const key of ['frequency_penalty', 'presence_penalty']) {
      if (providerDef.params.some((p) => p.key === key) && !(key in active)) {
        active[key] = 0
      }
    }
  }
  // OpenAI-compatible reasoning params: always pass through as strings
  if (active.reasoning_effort != null) {
    active.reasoning_effort = String(active.reasoning_effort)
  }
  if (active.include_reasoning != null) {
    active.include_reasoning = active.include_reasoning ? 'true' : 'false'
  }
  return active
}

export function buildTranscript({
  messages,
  personaName,
  currentPersonaName,
  includeOOCOverride,
  userPersonaPrefixOverride,
  personaMap,
  rolePrefixes,
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

  const lines = []

  for (const msg of messages) {
    if (msg.isSummaryMarker || msg.isAutoTitleMarker) continue
    if (msg.isOOC && !includeOOCOverride) continue

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

    if (prefix && !/\s$/.test(prefix)) prefix += '\n'

    lines.push(prefix + (msg.content || ''))
  }

  return lines.join('\n\n')
}

export async function buildOOCMessagesPayload({
  character,
  chatPersona,
  currentPersona,
  messages,
  oocSettings,
  userMessage,
  personaMap,
  memoryText,
  memoryHeader,
}) {
  const charName = character?.name || ''
  const personaName = chatPersona?.name || ''
  const currentPersonaName = currentPersona?.name || personaName
  const replaceVarsIn = (text) => replaceVars(text, { charName, personaName, currentPersonaName })

  const systemParts = []

  const oocSystemInstr = oocSettings.oocSystemInstructions
  const oocUserInstr = oocSettings.oocUserInstructions
  const systemHasTranscript = (oocSystemInstr || '').includes('{{transcript}}')

  const includeOOCOverride = character?.includeOOC === false ? false : true
  const userPersonaPrefixOverride = character?.userPersonaPrefix === false ? false : true

  let transcriptWithVars = ''
  if (messages.length > 0) {
    const transcript = buildTranscript({
      messages,
      personaName,
      currentPersonaName,
      includeOOCOverride,
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
    })
    transcriptWithVars = replaceVarsIn(transcript)
  }

  if (oocSystemInstr) {
    const sys = replaceVarsIn(oocSystemInstr)
    systemParts.push(
      systemHasTranscript ? sys.replace(/{{transcript}}/gi, transcriptWithVars) : sys,
    )
  }

  const prompt = replaceVarsIn(character?.prompt)
  if (prompt) {
    const charPromptHeader = oocSettings.characterPromptHeader
    if (charPromptHeader) {
      systemParts.push(replaceVarsIn(charPromptHeader) + '\n\n' + prompt)
    } else {
      systemParts.push(prompt)
    }
  }

  if (transcriptWithVars && !systemHasTranscript) {
    const messagesHeader = oocSettings.messagesHeader
    if (messagesHeader) {
      systemParts.push(replaceVarsIn(messagesHeader) + '\n\n' + transcriptWithVars)
    } else {
      systemParts.push(transcriptWithVars)
    }
  }

  const result = [{ role: 'system', content: systemParts.join('\n\n') }]
  const entryTypes = ['oocSystem']

  if (userMessage) {
    if (oocUserInstr) {
      const base = replaceVarsIn(oocUserInstr)
      const userHasTranscript = oocUserInstr.includes('{{transcript}}')
      let content = userHasTranscript ? base.replace(/{{transcript}}/gi, transcriptWithVars) : base
      if (content.includes('{{content}}')) {
        content = content.replace(/\{\{content\}\}/gi, userMessage)
      } else if (!userHasTranscript) {
        content += '\n\n' + userMessage
      }
      result.push({ role: 'user', content })
    } else {
      result.push({ role: 'user', content: userMessage })
    }
    entryTypes.push('oocUser')
  }

  if (memoryText) {
    return {
      payload: appendMemoryToPayload(result, memoryText, memoryHeader),
      entryTypes,
    }
  }

  return { payload: result, entryTypes }
}

// Mirrors buildMsgNumbersArray formerly defined in ChatView: maps each payload
// entry back to the originating message number for prompt-data inspection.
export function buildMsgNumbersArray(isFirstMessage, apiMessages, currentMsgs, payload) {
  const numMap = new Map(currentMsgs.map((m, i) => [m.id, i + 1]))
  const numbers = [null]
  if (isFirstMessage) {
    if (payload.length > 1) numbers.push(null)
  } else {
    for (const msg of apiMessages) {
      numbers.push(numMap.get(msg.id) || null)
    }
    if (payload.length > numbers.length) numbers.push(null)
  }
  return numbers
}

export async function buildChatRequestPayload({
  character,
  chatPersona,
  currentPersona,
  messages,
  isFirstMessage,
  isOOC,
  threadId,
  personaMap,
}) {
  const includeOOC = character?.includeOOC !== false
  const keepMessages = Number(
    character?.messagesToKeep ?? (await getSetting('defaultMessagesToKeep')) ?? 0,
  )
  const apiMessages = getMessagesForApiRequest(messages, { includeOOC, keepMessages })

  const latestThread = await getThread(threadId)
  const memoryText = await buildInjectedMemory(character, latestThread)

  let payload
  let entryTypes = null

  if (isOOC) {
    const oocSystemInstructions = await getSetting('prompting.oocSystem')
    const oocUserInstructions = await getSetting('prompting.oocUser')
    const characterPromptHeader = await getSetting(
      'prompting.apiRequestSectionHeaders.characterPrompt',
    )
    const messagesHeader = await getSetting('prompting.apiRequestSectionHeaders.messages')
    const systemRolePrefix = await getSetting('prompting.systemRolePrefix')
    const assistantRolePrefix = await getSetting('prompting.assistantRolePrefix')
    const userRolePrefix = await getSetting('prompting.userRolePrefix')
    const userRolePrefixWithPersona = await getSetting('prompting.userRolePrefixWithPersona')
    const systemRolePrefixOoc = await getSetting('prompting.systemRolePrefixOoc')
    const assistantRolePrefixOoc = await getSetting('prompting.assistantRolePrefixOoc')
    const userRolePrefixOoc = await getSetting('prompting.userRolePrefixOoc')

    const lastUserMsg =
      messages.length > 0 && messages[messages.length - 1].role === 'user'
        ? messages[messages.length - 1].content
        : ''

    const oocResult = await buildOOCMessagesPayload({
      character,
      chatPersona,
      currentPersona,
      messages: apiMessages.slice(0, -1),
      userMessage: lastUserMsg,
      personaMap,
      memoryText,
      memoryHeader: '',
      oocSettings: {
        oocSystemInstructions,
        oocUserInstructions,
        characterPromptHeader,
        messagesHeader,
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
      writingInjectionTiming: await getSetting('prompting.writingInjectionTiming'),
      writingPlacement: await getSetting('prompting.writingPlacement'),
      writingMessageRole: await getSetting('prompting.writingMessageRole'),
      writingInstructionHeader: await getSetting(
        'prompting.apiRequestSectionHeaders.writingInstruction',
      ),
      personaInjectionTiming: await getSetting('prompting.personaInjectionTiming'),
      personaInjectionPlacement: await getSetting('prompting.personaInjectionPlacement'),
      personaInjectionMessageRole: await getSetting('prompting.personaInjectionMessageRole'),
    }

    const chatResult = await buildMessagesPayload({
      character,
      chatPersona,
      currentPersona,
      messages: apiMessages,
      isFirstMessage,
      settings,
      writingInstruction,
      memoryText,
      memoryHeader: '',
    })
    payload = chatResult.payload
    entryTypes = chatResult.entryTypes
  }

  const msgNumbers = buildMsgNumbersArray(isFirstMessage, apiMessages, messages, payload)

  return { payload, entryTypes, msgNumbers }
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
}) {
  let baseUrl = getChatBaseUrl(profile.providerId)
  if (!baseUrl) {
    const rawUrl = await getBaseUrl(profile.providerId)
    if (rawUrl) {
      const stripped = rawUrl.replace(/\/+$/, '')
      baseUrl = stripped.endsWith('/v1') ? stripped : `${stripped}/v1`
    }
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
    return { content, response: json }
  } finally {
    reportTiming()
  }
}
