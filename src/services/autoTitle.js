import db from '../db'
import { getEffectiveProfileFor } from './connectionProfiles'
import { sendChatCompletion, replaceVars, buildTranscript } from './chatApi'
import { getSetting } from './settings'
import { updateThread } from './threads'

const DEFAULT_SYSTEM_INSTRUCTION = 'You are a title generator for conversational AI.'

export function getCountedMessageCount(messages, includeOOC) {
  if (includeOOC) return messages.length
  return messages.filter((m) => !m.isOOC).length
}

export async function shouldAutoTitle(thread, character, messages) {
  if (!character?.autoTitle) return false
  if (thread?.titleEdited) return false
  if (thread?.autoTitleGenerated) return false

  const threshold = character?.autoTitleThreshold ?? 3
  const includeOOC = character?.includeOOC !== false
  const count = getCountedMessageCount(messages, includeOOC)

  return count >= threshold
}

export async function triggerAutoTitle({ thread, character, messages, personaMap, signal }) {
  const charName = character.name || ''
  let personaName = ''
  if (thread.personaId) {
    const persona = await db.personas.get(thread.personaId)
    personaName = persona?.name || ''
  }
  const currentPersonaName = personaName
  const replaceVarsIn = (text) => replaceVars(text, { charName, personaName, currentPersonaName })

  let systemContent = character.autoTitleSystemInstructions
  if (!systemContent) {
    systemContent = await getSetting('prompting.autoTitleSystem')
  }
  if (!systemContent) {
    systemContent = DEFAULT_SYSTEM_INSTRUCTION
  }

  let userContent = character.autoTitleUserInstructions
  if (!userContent) {
    userContent = await getSetting('prompting.autoTitleUser')
  }

  const includeOOC = character.includeOOC !== false
  const userPersonaPrefix = character.userPersonaPrefix !== false

  const rolePrefixes = {
    systemRolePrefix: await getSetting('prompting.systemRolePrefix'),
    assistantRolePrefix: await getSetting('prompting.assistantRolePrefix'),
    userRolePrefix: await getSetting('prompting.userRolePrefix'),
    userRolePrefixWithPersona: await getSetting('prompting.userRolePrefixWithPersona'),
    systemRolePrefixOoc: await getSetting('prompting.systemRolePrefixOoc'),
    assistantRolePrefixOoc: await getSetting('prompting.assistantRolePrefixOoc'),
    userRolePrefixOoc: await getSetting('prompting.userRolePrefixOoc'),
  }

  const transcript = buildTranscript({
    messages,
    personaName,
    currentPersonaName,
    includeOOCOverride: includeOOC,
    userPersonaPrefixOverride: userPersonaPrefix,
    personaMap,
    rolePrefixes,
  })

  systemContent = replaceVarsIn(systemContent).replace(/{{transcript}}/g, transcript)

  const payload = [{ role: 'system', content: systemContent }]

  if (userContent) {
    userContent = replaceVarsIn(userContent).replace(/{{transcript}}/g, transcript)
    payload.push({ role: 'user', content: userContent })
  } else {
    payload.push({ role: 'user', content: transcript })
  }

  const profile = await getEffectiveProfileFor('autoTitle')
  if (!profile?.model) {
    throw new Error('No auto-title profile configured')
  }

  const title = await sendChatCompletion({ profile, messages: payload, signal })

  if (!title?.trim()) throw new Error('Empty title generated')

  const cleanTitle = title.trim()
  await updateThread(thread.id, { title: cleanTitle, autoTitleGenerated: true })

  return cleanTitle
}
