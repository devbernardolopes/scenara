import db from '../db'
import { getEffectiveProfileFor } from './connectionProfiles'
import { sendChatCompletion, replaceVars, buildTranscript, appendMemoryToPayload } from './chatApi'
import { getSetting } from './settings'
import { updateThread } from './threads'
import { trimLeadingTrailingNewlines } from './messages'
import { buildInjectedMemory } from './threadMemories'
import {
  getDirectorConfig,
  applyDirectorTemplate,
  buildDirectorMessages,
  getAutoTitleTemplateValues,
} from './director'
import { waitForCooldown, setCurrentRequestDirectorPhase } from './apiQueue'
import { showToast } from '../lib/toast'
import { run, disposeModel } from '../lib/inferenceClient'
import i18n from '../lib/i18n'

const LOCAL_TITLE_TIMEOUT_MS = 30000

async function tryLocalTitle(text) {
  const modelKey = (await getSetting('localInference.titleModel')) || 'title-generation'
  const freeMemory = await getSetting('localInference.freeMemory')

  const generationOptions = {
    max_new_tokens: (await getSetting('localInference.maxNewTokens')) ?? 16,
    repetition_penalty: (await getSetting('localInference.repetitionPenalty')) ?? 1.3,
    no_repeat_ngram_size: (await getSetting('localInference.noRepeatNgramSize')) ?? 3,
  }

  const result = await run(
    'title-generation',
    { text },
    { modelKey, generationOptions },
    { timeout: LOCAL_TITLE_TIMEOUT_MS },
  )

  if (freeMemory) {
    try {
      await disposeModel(modelKey)
    } catch {
      // best-effort cleanup
    }
  }

  if (typeof result === 'string') return result.trim()
  if (result && typeof result.title === 'string') return result.title.trim()
  return ''
}

const DEFAULT_SYSTEM_INSTRUCTION =
  'You are a title generator for conversational AI.\n\n{{transcript}}'

function sanitizeAutoTitle(text) {
  if (!text) return text
  let result = text.replace(/^\n+|\n+$/g, '')
  if (result.length >= 2) {
    const first = result[0]
    const last = result[result.length - 1]
    const isQuote = (ch) => ch === '"' || ch === '\u201c' || ch === '\u201d'
    if (isQuote(first) && isQuote(last)) {
      result = result.slice(1, -1)
    }
  }
  return result
}

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
    userContent = (await getSetting('prompting.autoTitleUser'))?.trim()
    if (!userContent) userContent = 'Create a title for the provided message exchange.'
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
  const memoryText = await buildInjectedMemory(character, thread)
  const payloadWithMemory = appendMemoryToPayload(payload, memoryText, '')

  if (userContent) {
    userContent = replaceVarsIn(userContent).replace(/{{transcript}}/gi, transcript)
    payloadWithMemory.push({ role: 'user', content: userContent })
  } else {
    payloadWithMemory.push({ role: 'user', content: transcript })
  }

  let title = ''
  let autoTitleDurationMs = null
  let directorDurationMs = null
  const useLocalInference = await getSetting('localInference.autoTitle')
  if (useLocalInference) {
    try {
      title = await tryLocalTitle(transcript)
    } catch {
      title = ''
    }
  }

  if (!title) {
    const profile = await getEffectiveProfileFor('autoTitle')
    if (!profile?.model) {
      throw new Error('No auto-title profile configured')
    }

    title = await sendChatCompletion({
      profile,
      messages: payloadWithMemory,
      signal,
      onTiming: (ms) => {
        autoTitleDurationMs = ms
      },
    })
  }

  if (!title?.trim()) throw new Error('Empty title generated')

  let cleanTitle = title.trim()
  let directorReviewed = false

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
        message_response: cleanTitle,
        message_system: payloadWithMemory.find((m) => m.role === 'system')?.content || '',
        message_user: payloadWithMemory.find((m) => m.role === 'user')?.content || '',
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
      setCurrentRequestDirectorPhase(true)
      let reviewed
      try {
        reviewed = await sendChatCompletion({
          profile: dProfile,
          messages: dPayload,
          signal,
          onTiming: (ms) => {
            directorDurationMs = ms
          },
        })
      } finally {
        setCurrentRequestDirectorPhase(false)
      }
      const trimMsgs = await getSetting('prompting.trimMessages')
      const reviewedTrimmed = trimMsgs ? trimLeadingTrailingNewlines(reviewed) : reviewed
      if (reviewedTrimmed?.trim()) {
        cleanTitle = reviewedTrimmed.trim()
        directorReviewed = true
      }
    } catch {
      showToast(i18n.t('chat:directorFailed'), { type: 'warning' })
    }
  }

  if (await getSetting('trimAutoTitle')) {
    cleanTitle = sanitizeAutoTitle(cleanTitle)
  }

  const apiDurationMs =
    directorReviewed && autoTitleDurationMs != null && directorDurationMs != null
      ? autoTitleDurationMs + directorDurationMs
      : autoTitleDurationMs

  await updateThread(thread.id, {
    title: cleanTitle,
    autoTitleGenerated: true,
    autoTitleApiDurationMs: apiDurationMs,
  })

  return cleanTitle
}
