import db from '../db'
import { updateMessage } from './messages'
import { updateThread } from './threads'
import { buildTranscript, replaceVars, sendChatCompletion } from './chatApi'
import { getEffectiveProfileFor } from './connectionProfiles'
import { getSetting } from './settings'
import { estimateTokens } from './tokenEstimator'

const DEFAULT_SYSTEM_INSTRUCTION = 'You are a memory generator for conversational AI.'

export function getUnsummarizedMessages(messages, { includeOOC = true } = {}) {
  if (!Array.isArray(messages)) return []
  return messages.filter((message) => !message?.summarizedAt && (includeOOC || !message?.isOOC))
}

export function getMessagesForApiRequest(messages, { includeOOC = true, keepMessages = 0 } = {}) {
  if (!Array.isArray(messages)) return []

  const eligible = messages.filter((message) => (includeOOC || !message?.isOOC))
  if (keepMessages <= 0) {
    return eligible.filter((message) => !message?.summarizedAt)
  }

  const cutoff = Math.max(0, eligible.length - keepMessages)
  return eligible.filter((message, index) => !message?.summarizedAt || index >= cutoff)
}

export function shouldTriggerSummarization({ character, messages, includeOOC = true }) {
  if (!character || character.memory === 'never') return false

  const unsummarizedMessages = getUnsummarizedMessages(messages, { includeOOC })
  const count = unsummarizedMessages.length
  if (character.memory === 'messages') {
    const threshold = Number(character.messagesThreshold ?? 7)
    return count >= threshold
  }

  if (character.memory === 'contextWindow') {
    const threshold = Number(character.contextWindowThreshold ?? 1024)
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
}) {
  const charName = character?.name || ''
  let personaName = ''
  if (thread?.personaId) {
    const persona = await db.personas.get(thread.personaId)
    personaName = persona?.name || ''
  }
  const currentPersonaName = currentPersona?.name || personaName

  const replaceVarsIn = (text) =>
    replaceVars(text, { charName, personaName, currentPersonaName })

  const includeOOCOverride = character?.includeOOC !== false
  const userPersonaPrefixOverride = character?.userPersonaPrefix !== false

  const transcript = buildTranscript({
    messages,
    personaName,
    currentPersonaName,
    includeOOCOverride,
    userPersonaPrefixOverride,
    personaMap,
    rolePrefixes,
  })

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

  systemContent = replaceVarsIn(systemContent).replace(/{{transcript}}/g, transcript)

  const payload = [{ role: 'system', content: systemContent }]
  if (userContent) {
    userContent = replaceVarsIn(userContent).replace(/{{transcript}}/g, transcript)
    payload.push({ role: 'user', content: userContent })
  } else {
    payload.push({ role: 'user', content: transcript })
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

  const payload = await buildSummarizationPayload({
    character,
    thread,
    messages: unsummarizedMessages,
    personaMap,
    rolePrefixes,
    currentPersona,
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
  await updateThread(thread.id, { memory: cleanedSummary, lastSummarizationAt: timestamp })

  return cleanedSummary
}
