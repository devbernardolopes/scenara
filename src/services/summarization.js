import db from '../db'
import { getMessagesByThread, updateMessage, deleteMessage } from './messages'
import { updateThread } from './threads'
import { buildTranscript, replaceVars, sendChatCompletion } from './chatApi'
import { createThreadMemory, buildInjectedMemory } from './threadMemories'
import { resolveScenarioInjection, resolveGlobalContextInjection } from './scenarios'
import { getEffectiveProfileFor } from './connectionProfiles'
import { getSetting } from './settings'
import { estimateTokens } from './tokenEstimator'
import {
  cancelSummarizationRequests,
  getThreadQueuedCount,
  getThreadInflightCount,
} from './apiQueue'
import { removeCodeBlocksFromMessages, removeMarkdownImagesFromMessages } from './chatApi'

const DEFAULT_SYSTEM_INSTRUCTION = 'You are a memory generator for conversational AI.'

export function getUnsummarizedMessages(messages, { includeOOC = true } = {}) {
  if (!Array.isArray(messages)) return []
  return messages.filter(
    (message) =>
      !message?.isSummaryMarker &&
      !message?.isAutoTitleMarker &&
      !message?.summarizedAt &&
      (includeOOC || !message?.isOOC),
  )
}

export async function shouldTriggerSummarization({ character, messages, includeOOC = true }) {
  if (!character) return false

  const resolvedMemory = character.memory ?? (await getSetting('defaultMemory')) ?? 'messages'
  if (resolvedMemory === 'never') return false

  const unsummarizedMessages = getUnsummarizedMessages(messages, { includeOOC })
  const count = unsummarizedMessages.length
  if (resolvedMemory === 'messages') {
    const threshold = Number(
      character.messagesThreshold ?? (await getSetting('defaultMessagesThreshold')) ?? 7,
    )
    return count >= threshold
  }

  if (resolvedMemory === 'contextWindow') {
    const threshold = Number(
      character.contextWindowThreshold ??
        (await getSetting('defaultContextWindowThreshold')) ??
        1024,
    )
    const tokenCount = unsummarizedMessages.reduce(
      (total, message) => total + estimateTokens(message?.content || ''),
      0,
    )
    return tokenCount >= threshold
  }

  return false
}

export async function buildSummarizationPayload({
  character,
  thread,
  messages,
  personaMap,
  rolePrefixes,
  currentPersona,
  memoryText,
}) {
  const keepCodeBlocks = await getSetting('prompting.keepCodeBlocks')
  let processedMessages = removeCodeBlocksFromMessages(messages, keepCodeBlocks)

  if (character?.removeMarkdownImages !== false) {
    processedMessages = removeMarkdownImagesFromMessages(processedMessages)
  }

  const charName = character?.name || ''
  let personaName = ''
  let personaDescription = currentPersona?.description || ''
  if (thread?.personaId) {
    const persona = await db.personas.get(thread.personaId)
    personaName = persona?.name || ''
    personaDescription = persona?.description || personaDescription
  }
  const currentPersonaName = currentPersona?.name || personaName

  const replaceVarsIn = (text) => replaceVars(text, { charName, personaName, currentPersonaName })

  const includeOOCOverride = character?.includeOOC !== false
  const userPersonaPrefixOverride = character?.userPersonaPrefix !== false

  let transcript = replaceVarsIn(
    buildTranscript({
      messages: processedMessages,
      personaName,
      currentPersonaName,
      includeOOCOverride,
      userPersonaPrefixOverride,
      personaMap,
      rolePrefixes,
    }),
  )

  // When Add Character Prompt is enabled and persona injection is set to
  // "always" + "end of system prompt", mirror the chat payload by injecting the
  // persona template just after the character prompt (outside the transcript).
  let personaInjection = ''
  if (character?.addCharacterPrompt) {
    const personaTiming =
      character?.personaInjectionTiming || (await getSetting('prompting.personaInjectionTiming'))
    const personaPlacement =
      character?.personaInjectionPlacement ||
      (await getSetting('prompting.personaInjectionPlacement'))
    const personaTemplate = await getSetting('prompting.personaInjectionTemplate')
    if (personaTiming === 'always' && personaTemplate && personaPlacement === 'endOfSystemPrompt') {
      const resolvedPersona = personaTemplate.replace(/{{description}}/gi, personaDescription)
      personaInjection = replaceVarsIn(resolvedPersona)
    }
  }

  let systemContent = character?.summarizationSystemInstructions
  if (!systemContent) {
    systemContent = await getSetting('prompting.summarizationSystem')
  }
  if (!systemContent) {
    systemContent = DEFAULT_SYSTEM_INSTRUCTION
  }

  let userContent = character?.summarizationUserInstructions
  if (!userContent) {
    userContent = await getSetting('prompting.summarizationUser')
  }

  const messagesHeader = (await getSetting('prompting.apiRequestSectionHeaders.messages')) || ''
  const charPromptHeader =
    (await getSetting('prompting.apiRequestSectionHeaders.characterPrompt')) || ''

  const memorySection = memoryText ? memoryText : ''

  // Prepend the character prompt (when the per-character override is enabled)
  // to the start of the transcript, preceded by the Character Prompt section
  // header if configured — mirroring how the memory section is assembled above.
  // The active scenario is appended right after the character prompt, but only
  // when the character prompt is injected (i.e. the override is on).
  let charPromptSection = ''
  if (character?.addCharacterPrompt) {
    const prompt = replaceVarsIn(character?.prompt || '')
    if (prompt) {
      const parts = [prompt]

      const personality = replaceVarsIn(character?.personality || '')
      if (personality) parts.push(personality)

      const globalContextRaw = resolveGlobalContextInjection(character, {
        isFirstMessage: false,
        lastSummarizationAt: thread?.lastSummarizationAt || null,
      })
      if (globalContextRaw) parts.push(replaceVarsIn(globalContextRaw))

      let combined = parts.join('\n\n')

      const scenarioText = resolveScenarioInjection(character, {
        isFirstMessage: false,
        lastSummarizationAt: thread?.lastSummarizationAt || null,
        activeScenario: thread?.activeScenario || null,
      })
      const resolvedScenario = scenarioText ? replaceVarsIn(scenarioText) : ''
      if (resolvedScenario) combined = `${combined}\n\n${resolvedScenario}`

      if (personaInjection) combined = `${combined}\n\n${personaInjection}`
      charPromptSection = charPromptHeader
        ? `${replaceVarsIn(charPromptHeader)}\n\n${combined}`
        : combined
    }
  }

  const transcriptSection = messagesHeader
    ? `${replaceVarsIn(messagesHeader)}\n\n${transcript}`
    : transcript

  // Character prompt is placed at the very top of the payload, before any
  // memory injection, when the per-character override is enabled.
  const fullContent = [charPromptSection, memorySection, transcriptSection]
    .filter(Boolean)
    .join('\n\n')

  systemContent = replaceVarsIn(systemContent).replace(/{{transcript}}/gi, fullContent)

  const payload = [{ role: 'system', content: systemContent }]
  if (userContent) {
    userContent = replaceVarsIn(userContent).replace(/{{transcript}}/gi, fullContent)
    payload.push({ role: 'user', content: userContent })
  } else {
    payload.push({ role: 'user', content: fullContent })
  }

  return payload
}

export async function triggerSummarization({
  thread,
  character,
  messages: _messages,
  personaMap,
  signal,
  currentPersona,
}) {
  const includeOOC = character?.includeOOC !== false

  // Re-fetch messages from DB so we never operate on a stale snapshot.
  // Concurrent summarization jobs or rapid sends can mark messages as
  // summarized between enqueue time and execution time.
  const freshMessages = await getMessagesByThread(thread.id)
  const unsummarizedMessages = getUnsummarizedMessages(freshMessages, { includeOOC })
  if (unsummarizedMessages.length === 0) {
    return ''
  }

  const rolePrefixes = {
    systemRolePrefix: await getSetting('prompting.systemRolePrefix'),
    assistantRolePrefix: await getSetting('prompting.assistantRolePrefix'),
    userRolePrefix: await getSetting('prompting.userRolePrefix'),
    userRolePrefixWithPersona: await getSetting('prompting.userRolePrefixWithPersona'),
    systemRolePrefixOoc: await getSetting('prompting.systemRolePrefixOoc'),
    assistantRolePrefixOoc: await getSetting('prompting.assistantRolePrefixOoc'),
    userRolePrefixOoc: await getSetting('prompting.userRolePrefixOoc'),
  }

  const memoryText = await buildInjectedMemory(character, thread)

  const payload = await buildSummarizationPayload({
    character,
    thread,
    messages: unsummarizedMessages,
    personaMap,
    rolePrefixes,
    currentPersona,
    memoryText,
  })

  const profile = await getEffectiveProfileFor('summarization')
  if (!profile?.model) {
    throw new Error('No summarization profile configured')
  }

  let apiDurationMs = null
  const sendResult = await sendChatCompletion({
    profile,
    messages: payload,
    signal,
    threadId: thread.id,
    kind: 'summarization',
    onTiming: (ms) => {
      apiDurationMs = ms
    },
  })
  const summary = sendResult.content
  if (!summary?.trim()) throw new Error('Empty summary generated')

  const cleanedSummary = summary.trim()
  const timestamp = new Date().toISOString()
  await Promise.all(
    unsummarizedMessages.map((message) => updateMessage(message.id, { summarizedAt: timestamp })),
  )
  await createThreadMemory({
    threadId: thread.id,
    content: cleanedSummary,
    payload,
    model: profile.model,
    params: profile.params,
    apiDurationMs,
  })
  await updateThread(thread.id, { lastSummarizationAt: timestamp })

  return cleanedSummary
}

const pendingMarkers = new Map()

export function registerPendingMarker(threadId, markerId) {
  pendingMarkers.set(Number(threadId), markerId)
}

export function clearPendingMarker(threadId) {
  pendingMarkers.delete(Number(threadId))
}

export async function cancelPendingSummarizationAndClearMarker(threadId) {
  const tid = Number(threadId)

  const wasActive =
    getThreadQueuedCount(tid, { kinds: ['summarization'] }) > 0 ||
    getThreadInflightCount(tid, { kinds: ['summarization'] }) > 0

  cancelSummarizationRequests(tid)

  if (wasActive) {
    const markerId = pendingMarkers.get(tid)
    if (markerId != null) {
      pendingMarkers.delete(tid)
      try {
        await deleteMessage(markerId)
      } catch {
        // Marker might already be deleted
      }
      return markerId
    }
  }

  pendingMarkers.delete(tid)
  return null
}
