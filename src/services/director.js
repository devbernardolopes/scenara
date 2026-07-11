import { getSetting } from './settings'

export async function getDirectorReviewConfig(character) {
  if (!character?.directorEnabled) return null
  if (!character.directorRegularChatEnabled) return null
  const userInstructions = character.directorRegularChatInstructions?.trim()
  if (!userInstructions) return null
  const systemInstructions = (await getSetting('prompting.directorSystem'))?.trim()
  if (!systemInstructions) return null
  return { systemInstructions, userInstructions }
}

export function buildDirectorMessages({ systemInstructions, userInstructions }) {
  return [
    { role: 'system', content: systemInstructions },
    { role: 'user', content: userInstructions },
  ]
}

export function applyDirectorTemplate(text, { message, writingInstructions, char, user, name }) {
  if (!text) return text
  return text
    .replace(/\{\{message\}\}/gi, message || '')
    .replace(/\{\{writing_instructions\}\}/gi, writingInstructions || '')
    .replace(/\{\{char\}\}/gi, char || '')
    .replace(/\{\{user\}\}/gi, user || '')
    .replace(/\{\{name\}\}/gi, name || '')
}
