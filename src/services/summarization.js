import db from '../db'
import { updateMessage } from './messages'
import { updateThread } from './threads'
import { buildTranscript, replaceVars, sendChatCompletion } from './chatApi'
import { createThreadMemory } from './threadMemories'
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
  memoryHeader,
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
  const memorySection = memoryText
    ? memoryHeader
      ? `${memoryHeader}\n\n${memoryText}`
      : memoryText
    : ''
  const transcriptSection = messagesHeader
    ? `${replaceVarsIn(messagesHeader)}\n\n${transcript}`
    : transcript
  const fullContent = memorySection ? `${memorySection}\n\n${transcriptSection}` : transcriptSection

  systemContent = replaceVarsIn(systemContent).replace(/{{transcript}}/g, fullContent)

  const payload = [{ role: 'system', content: systemContent }]
  if (userContent) {
    userContent = replaceVarsIn(userContent).replace(/{{transcript}}/g, fullContent)
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

  const memoryHeader = await getSetting('prompting.apiRequestSectionHeaders.memories')
  const memoryText = thread?.memory || ''

  const payload = await buildSummarizationPayload({
    character,
    thread,
    messages: unsummarizedMessages,
    personaMap,
    rolePrefixes,
    currentPersona,
    memoryText,
    memoryHeader,
  })

  const profile = await getEffectiveProfileFor('summarization')
  if (!profile?.model) {
    throw new Error('No summarization profile configured')
  }

  const summary = await sendChatCompletion({ profile, messages: payload, signal })
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
  })
  await updateThread(thread.id, { memory: cleanedSummary, lastSummarizationAt: timestamp })

  return cleanedSummary
}
