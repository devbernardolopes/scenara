import { getSetting } from './settings'

const DIRECTOR_GROUPS = {
  regularChat: {
    enabledKey: 'directorRegularChatEnabled',
    instructionsKey: 'directorRegularChatInstructions',
    systemInstructionsKey: 'directorRegularChatSystemInstructions',
    outputDirectorResponseKey: 'directorRegularChatOutputDirectorResponse',
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
  let systemInstructions = g.systemInstructionsKey
    ? character[g.systemInstructionsKey]?.trim()
    : undefined
  if (!systemInstructions)
    systemInstructions = (await getSetting('prompting.directorSystem'))?.trim()
  if (!systemInstructions) return null
  const outputDirectorResponse = g.outputDirectorResponseKey
    ? character[g.outputDirectorResponseKey] !== false
    : true
  return { systemInstructions, userInstructions, outputDirectorResponse }
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

export async function applyDirectorTemplate(
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
    status_block,
    memory,
    messagesTranscript,
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
    ['status_block', status_block],
    ['memory', memory],
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

  if (messagesTranscript) {
    next = await resolveMessagesTokens(next, messagesTranscript)
  }

  return next
}

// Dynamic {{messages_N}} template: substituted with the transcript of the last N
// chat messages (including the current response), stopping at the oldest message
// when the history is shorter than N. When no resolver is provided the tokens are
// left as-is (consistent with unknown tokens).
const MESSAGES_N_RE = /\{\{messages_(\d+)\}\}/gi

async function resolveMessagesTokens(text, messagesTranscript) {
  const matches = [...text.matchAll(MESSAGES_N_RE)]
  if (matches.length === 0) return text
  const cache = new Map()
  const parts = []
  let last = 0
  for (const match of matches) {
    const n = Number(match[1])
    let resolved = cache.get(n)
    if (resolved === undefined) {
      resolved = (await messagesTranscript(n)) ?? ''
      cache.set(n, resolved)
    }
    parts.push(text.slice(last, match.index))
    parts.push(resolved)
    last = match.index + match[0].length
  }
  parts.push(text.slice(last))
  return parts.join('')
}

const DEFAULT_AUTO_TITLE_SYSTEM =
  'You are a title generator for conversational AI.\n\n{{transcript}}'

export async function getAutoTitleTemplateValues(character) {
  let systemAutoTitle = character?.autoTitleSystemInstructions?.trim()
  if (!systemAutoTitle) systemAutoTitle = (await getSetting('prompting.autoTitleSystem'))?.trim()
  if (!systemAutoTitle) systemAutoTitle = DEFAULT_AUTO_TITLE_SYSTEM

  let userAutoTitle = character?.autoTitleUserInstructions?.trim()
  if (!userAutoTitle) userAutoTitle = (await getSetting('prompting.autoTitleUser'))?.trim()
  if (!userAutoTitle)
    userAutoTitle = 'Create a title in the language of the provided message exchange.'

  return { system_autotitle: systemAutoTitle, user_autotitle: userAutoTitle }
}
