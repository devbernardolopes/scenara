import { getEffectiveProfileFor } from './connectionProfiles'
import { applyDirectorTemplate, buildDirectorMessages } from './director'
import {
  buildMessagesWindowTranscript,
  getActiveParams,
  prefixAssistantMessage,
  replaceVars,
  sendChatCompletion,
} from './chatApi'
import { getWritingInstruction } from './writingInstructions'
import { getThread } from './threads'
import { getEffectiveStatusBlock } from './statusBlocks'
import { buildInjectedMemory } from './threadMemories'
import i18n from '../lib/i18n'
import { showToast } from '../lib/toast'

// The Status Block director reviews the current per-chat Status Block against
// the character's dedicated status-block director prompts and returns a refined
// block. Unlike the regular-chat director group it never falls back to a
// global system prompt: both the system and user instructions must be set on
// the character for the pass to run.
export function getStatusBlockDirectorConfig(character) {
  if (!character?.directorEnabled) return null
  if (!character?.directorRegularChatStatusBlockEnabled) return null
  const systemInstructions = character?.directorRegularChatStatusBlockSystemInstructions?.trim()
  const userInstructions = character?.directorRegularChatStatusBlockInstructions?.trim()
  if (!systemInstructions || !userInstructions) return null
  return { systemInstructions, userInstructions }
}

// Runs the status-block Director pass for a regular (non-OOC) message slot.
// Returns null when the group is not configured or the current status block is
// empty, `{ status: 'success', content, responseData, apiDurationMs }` on
// success (content may be empty — callers fall back to the current block), or
// `{ status: 'error', error }` on failure. Aborts are treated as failures so
// the underlying chat message can still finalize with its current status block.
export async function runStatusBlockDirector({
  character,
  chatPersona,
  currentPersona,
  threadId,
  message,
  messageSystem,
  messageUser,
  messages,
  personaMap,
  signal,
  ctx,
  onMeta,
  statusBlock: statusBlockOverride,
}) {
  const config = getStatusBlockDirectorConfig(character)
  if (!config) return null

  const latestThread = await getThread(threadId)
  const memoryText = await buildInjectedMemory(character, latestThread)
  const statusBlock = replaceVars(
    statusBlockOverride != null
      ? statusBlockOverride
      : getEffectiveStatusBlock(character, latestThread?.statusBlock),
    {
      charName: character?.name || '',
      personaName: chatPersona?.name || '',
      currentPersonaName: currentPersona?.name || chatPersona?.name || '',
    },
  )
  if (!statusBlock?.trim()) return null

  let writingInstructionContent = ''
  if (character?.writingInstruction) {
    const wi = await getWritingInstruction(Number(character.writingInstruction))
    writingInstructionContent = wi?.content || ''
  }

  const charName = character?.name || ''
  const personaName = chatPersona?.name || ''
  const currentPersonaName = currentPersona?.name || personaName

  const prefixedMessage = await prefixAssistantMessage(message, {
    charName,
    personaName,
    currentPersonaName,
  })

  const messagesTranscript = await buildMessagesWindowTranscript({
    baseMessages: messages,
    responseContent: message,
    character,
    chatPersona,
    currentPersona,
    personaMap,
  })

  const templateVars = {
    message: prefixedMessage,
    message_response: prefixedMessage,
    message_system: messageSystem || '',
    message_user: messageUser || '',
    messagesTranscript,
    writingInstructions: writingInstructionContent,
    status_block: statusBlock,
    memory: memoryText,
    char: charName,
    user: personaName,
    name: currentPersonaName,
  }
  const systemInstructions = await applyDirectorTemplate(config.systemInstructions, templateVars)
  const userInstructions = await applyDirectorTemplate(config.userInstructions, templateVars)
  const dPayload = buildDirectorMessages({ systemInstructions, userInstructions })

  const dProfile = await getEffectiveProfileFor('director', character)
  if (!dProfile?.model) {
    return { status: 'error', error: i18n.t('chat:noProfileModel') }
  }

  showToast(i18n.t('chat:statusBlockDirectorReviewing'), { type: 'info' })
  ctx?.setDirectorPhase?.(true)
  let apiDurationMs = null
  try {
    const result = await sendChatCompletion({
      profile: dProfile,
      messages: dPayload,
      signal,
      threadId,
      kind: 'director',
      charName,
      personaName,
      assistantSpeaker: character?.speakerName || charName,
      personaMap,
      onActivity: ctx?.markActivity,
      onMeta,
      onTiming: (ms) => {
        apiDurationMs = ms
      },
    })
    return {
      status: 'success',
      content: result.content || '',
      responseData: result.response,
      apiDurationMs,
      systemInstructions,
      userInstructions,
      directorModel: dProfile.model || '',
      directorParams: getActiveParams(dProfile),
    }
  } catch (err) {
    return { status: 'error', error: err }
  } finally {
    ctx?.setDirectorPhase?.(false)
  }
}
