import db from '../db'
import { getEffectiveProfileFor } from './connectionProfiles'
import { sendChatCompletion, replaceVars, buildTranscript, appendMemoryToPayload } from './chatApi'
import { getSetting } from './settings'
import { updateThread } from './threads'
import {
  getDirectorConfig,
  applyDirectorTemplate,
  buildDirectorMessages,
  getAutoTitleTemplateValues,
} from './director'
import { waitForCooldown } from './apiQueue'
import { showToast } from '../lib/toast'
import i18n from '../lib/i18n'

const DEFAULT_SYSTEM_INSTRUCTION = 'You are a title generator for conversational AI.'

export function getCountedMessageCount(messages, includeOOC) {
  const counted = messages.filter((m) => !m?.isSummaryMarker && !m?.isAutoTitleMarker)
  if (includeOOC) return counted.length
  return counted.filter((m) => !m.isOOC).length
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

  systemContent = replaceVarsIn(systemContent).replace(/{{transcript}}/gi, transcript)

  const payload = [{ role: 'system', content: systemContent }]
  const memoryHeader = await getSetting('prompting.apiRequestSectionHeaders.memories')
  const payloadWithMemory = appendMemoryToPayload(payload, thread?.memory, memoryHeader)

  if (userContent) {
    userContent = replaceVarsIn(userContent).replace(/{{transcript}}/gi, transcript)
    payloadWithMemory.push({ role: 'user', content: userContent })
  } else {
    payloadWithMemory.push({ role: 'user', content: transcript })
  }

  const profile = await getEffectiveProfileFor('autoTitle')
  if (!profile?.model) {
    throw new Error('No auto-title profile configured')
  }

  const title = await sendChatCompletion({ profile, messages: payloadWithMemory, signal })

  if (!title?.trim()) throw new Error('Empty title generated')

  let cleanTitle = title.trim()

  const directorConfig = await getDirectorConfig(character, 'autoTitle')
  if (directorConfig) {
    try {
      const dProfile = await getEffectiveProfileFor('director')
      if (!dProfile?.model) throw new Error('No Director profile configured')
      await waitForCooldown()
      showToast(i18n.t('chat:directorReviewing'), { type: 'info' })
      const { system_autotitle, user_autotitle } = await getAutoTitleTemplateValues(character)
      const templateVars = {
        message: cleanTitle,
        writingInstructions: '',
        char: charName,
        user: personaName,
        name: currentPersonaName,
        system_autotitle,
        user_autotitle,
      }
      const systemInstructions = applyDirectorTemplate(
        directorConfig.systemInstructions,
        templateVars,
      )
      const userInstructions = applyDirectorTemplate(directorConfig.userInstructions, templateVars)
      const dPayload = buildDirectorMessages({ systemInstructions, userInstructions })
      const reviewed = await sendChatCompletion({ profile: dProfile, messages: dPayload, signal })
      if (reviewed?.trim()) cleanTitle = reviewed.trim()
    } catch {
      showToast(i18n.t('chat:directorFailed'), { type: 'warning' })
    }
  }

  await updateThread(thread.id, { title: cleanTitle, autoTitleGenerated: true })

  return cleanTitle
}
