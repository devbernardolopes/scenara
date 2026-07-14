import db from '../db'
import { updateMessage } from './messages'
import { updateThread } from './threads'
import { buildTranscript, replaceVars, sendChatCompletion } from './chatApi'
import { createThreadMemory, buildInjectedMemory, pruneThreadMemories } from './threadMemories'
import { getEffectiveProfileFor } from './connectionProfiles'
import { getSetting } from './settings'
import { estimateTokens } from './tokenEstimator'

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

export function appendMemoryToPayload(payload, memoryText, memoryHeader) {
  if (!Array.isArray(payload) || payload.length === 0) return payload
  const firstEntry = payload[0]
  if (!firstEntry || firstEntry.role !== 'system') return payload
  if (!memoryText) return payload

  const section = memoryHeader ? `${memoryHeader}\n\n${memoryText}` : `\n\n${memoryText}`
  const content = `${firstEntry.content || ''}${firstEntry.content ? '\n\n' : ''}${section}`

  return [{ ...firstEntry, content }, ...payload.slice(1)]
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
  const charName = character?.name || ''
  let personaName = ''
  if (thread?.personaId) {
    const persona = await db.personas.get(thread.personaId)
    personaName = persona?.name || ''
  }
  const currentPersonaName = currentPersona?.name || personaName

  const replaceVarsIn = (text) => replaceVars(text, { charName, personaName, currentPersonaName })

  const includeOOCOverride = character?.includeOOC !== false
  const userPersonaPrefixOverride = character?.userPersonaPrefix !== false

  let transcript = replaceVarsIn(
    buildTranscript({
      messages,
      personaName,
      currentPersonaName,
      includeOOCOverride,
      userPersonaPrefixOverride,
      personaMap,
      rolePrefixes,
    }),
  )

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
  const memorySection = memoryText ? memoryText : ''
  const transcriptSection = messagesHeader
    ? `${replaceVarsIn(messagesHeader)}\n\n${transcript}`
    : transcript
  const fullContent = memorySection ? `${memorySection}\n\n${transcriptSection}` : transcriptSection

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
  messages,
  personaMap,
  signal,
  currentPersona,
}) {
  const includeOOC = character?.includeOOC !== false
  const unsummarizedMessages = getUnsummarizedMessages(messages, { includeOOC })
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

  const memorySlots = character?.memorySlots ?? (await getSetting('defaultMemorySlots')) ?? 3
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
  await pruneThreadMemories(thread.id, memorySlots)
  await updateThread(thread.id, { lastSummarizationAt: timestamp })

  return cleanedSummary
}
