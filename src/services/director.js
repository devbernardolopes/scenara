import { getSetting } from './settings'

const DIRECTOR_GROUPS = {
  regularChat: {
    enabledKey: 'directorRegularChatEnabled',
    instructionsKey: 'directorRegularChatInstructions',
  },
  autoTitle: {
    enabledKey: 'directorAutoTitleEnabled',
    instructionsKey: 'directorAutoTitleInstructions',
  },
}

export async function getDirectorConfig(character, group) {
  if (!character?.directorEnabled) return null
  const g = DIRECTOR_GROUPS[group]
  if (!g) return null
  if (!character[g.enabledKey]) return null
  const userInstructions = character[g.instructionsKey]?.trim()
  if (!userInstructions) return null
  const systemInstructions = (await getSetting('prompting.directorSystem'))?.trim()
  if (!systemInstructions) return null
  return { systemInstructions, userInstructions }
}

export async function getDirectorReviewConfig(character) {
  return getDirectorConfig(character, 'regularChat')
}

export function buildDirectorMessages({ systemInstructions, userInstructions }) {
  return [
    { role: 'system', content: systemInstructions },
    { role: 'user', content: userInstructions },
  ]
}

export function applyDirectorTemplate(
  text,
  {
    message,
    message_response,
    message_system,
    message_user,
    writingInstructions,
    char,
    user,
    name,
    system_autotitle,
    user_autotitle,
  } = {},
) {
  if (!text) return text

  const rules = [
    ['message', message],
    ['message_response', message_response ?? message],
    ['message_system', message_system],
    ['message_user', message_user],
    ['writing_instructions', writingInstructions],
    ['system_autotitle', system_autotitle],
    ['user_autotitle', user_autotitle],
    ['char', char],
    ['user', user],
    ['name', name],
  ]

  const replaceOnce = (s) => {
    let out = s
    for (const [key, val] of rules) {
      out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), val ?? '')
    }
    return out
  }

  let prev = text
  let next = replaceOnce(prev)
  let passes = 0
  const MAX_PASSES = 10
  while (next !== prev && passes < MAX_PASSES) {
    prev = next
    next = replaceOnce(prev)
    passes++
  }

  return next
}

const DEFAULT_AUTO_TITLE_SYSTEM = 'You are a title generator for conversational AI.'

export async function getAutoTitleTemplateValues(character) {
  let systemAutoTitle = character?.autoTitleSystemInstructions?.trim()
  if (!systemAutoTitle) systemAutoTitle = (await getSetting('prompting.autoTitleSystem'))?.trim()
  if (!systemAutoTitle) systemAutoTitle = DEFAULT_AUTO_TITLE_SYSTEM

  let userAutoTitle = character?.autoTitleUserInstructions?.trim()
  if (!userAutoTitle) userAutoTitle = (await getSetting('prompting.autoTitleUser'))?.trim()
  if (!userAutoTitle) userAutoTitle = '{{transcript}}'

  return { system_autotitle: systemAutoTitle, user_autotitle: userAutoTitle }
}
