import { getEffectiveProfileFor } from './connectionProfiles'
import { getDirectorReviewConfig, buildDirectorMessages, applyDirectorTemplate } from './director'
import {
  buildChatRequestPayload,
  buildMessagesWindowTranscript,
  getActiveParams,
  getLastNonOocUserMessageContent,
  prefixAssistantMessage,
  replaceVars,
  sendChatCompletion,
  stripOOCDelimiters,
} from './chatApi'
import { getWritingInstruction } from './writingInstructions'
import { getSetting } from './settings'
import { getThread } from './threads'
import { getEffectiveStatusBlock } from './statusBlocks'
import { runStatusBlockDirector } from './statusBlockDirector'
import { trimLeadingTrailingNewlines, trimWhitespace } from './messages'
import i18n from '../lib/i18n'
import { showToast } from '../lib/toast'

export function parseBundleEntries(bundleMessages) {
  if (!bundleMessages) return null
  try {
    const parsed = JSON.parse(bundleMessages)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    if (typeof parsed[0] === 'string') {
      return parsed.map((content) => ({ content, promptData: null }))
    }
    return parsed
  } catch {
    return null
  }
}

export function computeMessageFlags(entryTypes, msgNumbers, currentMsgs, { beforeDate } = {}) {
  if (!entryTypes) return null
  const realMsgs = currentMsgs.filter((m) => !m.isSummaryMarker && !m.isAutoTitleMarker)
  return entryTypes.map((type, i) => {
    const flags = []
    if (type === 'system') {
      flags.push('SYS')
    } else if (type === 'oocSystem') {
      flags.push('SYS')
      flags.push('OOC')
    } else if (type === 'oocUser') {
      flags.push('OOC')
    } else if (type !== 'chatMessage') {
      flags.push('TMP')
    }
    const num = msgNumbers?.[i]
    if (num != null) {
      const dbMsg = realMsgs[num - 1]
      if (dbMsg?.bundleMessages) {
        try {
          const entries = JSON.parse(dbMsg.bundleMessages)
          if (
            Array.isArray(entries) &&
            entries.length > 0 &&
            entries.every((e) => e.origin === 'initial')
          ) {
            flags.push('INI')
          }
        } catch {}
      }
      if (dbMsg?.summarizedAt && (!beforeDate || new Date(dbMsg.summarizedAt) <= beforeDate)) {
        flags.push('SUM')
        flags.push('KEP')
      }
    }
    return flags
  })
}

export async function generateChatResponse({
  character,
  chatPersona,
  currentPersona,
  currentMsgs,
  isFirstMessage,
  isThreadStart,
  isOOC,
  threadId,
  personaMap,
  signal,
  onToken,
  onFinish,
  ctx,
  beforeDate,
  statusBlock: statusBlockOverride,
}) {
  const profile = isOOC
    ? await getEffectiveProfileFor('ooc', character)
    : await getEffectiveProfileFor('chat', character)

  if (!profile?.model) {
    showToast(i18n.t('chat:noProfileModel'), { type: 'error' })
    return {
      status: 'no-profile',
      content: '',
      promptData: null,
      responseData: null,
      apiDurationMs: null,
      directorReviewed: false,
      error: null,
    }
  }

  const directorConfig = !isOOC ? await getDirectorReviewConfig(character) : null

  const charName = character?.name || ''
  const personaName = chatPersona?.name || currentPersona?.name || ''
  const assistantSpeaker = character?.speakerName || charName

  const {
    payload,
    entryTypes,
    msgNumbers,
    messages: apiMessages,
    loreActivated,
    lorebooks,
  } = await buildChatRequestPayload({
    character,
    chatPersona,
    currentPersona,
    messages: currentMsgs,
    isFirstMessage,
    isThreadStart,
    isOOC,
    threadId,
    personaMap,
    beforeDate,
    statusBlock: statusBlockOverride,
  })

  // Latest (last) non-OOC user message from the API call — used by both the
  // regular-chat Director and the Status Block Director passes.
  const messageUser = getLastNonOocUserMessageContent(payload, entryTypes, apiMessages)

  const payloadStatusBlock =
    statusBlockOverride != null
      ? getEffectiveStatusBlock(character, statusBlockOverride)
      : getEffectiveStatusBlock(character, (await getThread(threadId))?.statusBlock)

  const activeParams = getActiveParams(profile)
  const messageFlags = computeMessageFlags(entryTypes, msgNumbers, currentMsgs, { beforeDate })
  let directorReviewed = false
  let directorAttempted = false
  let directorSystemPrompt = ''
  let directorUserPrompt = ''
  let directorOriginalMessage = ''
  let directorResponse = ''
  let directorResponseData = null
  let directorFailed = false
  let chatDurationMs = null
  let directorDurationMs = null
  let statusBlockDirectorAttempted = false
  let statusBlockDirectorSystemPrompt = ''
  let statusBlockDirectorUserPrompt = ''
  let statusBlockDirectorModel = ''
  let statusBlockDirectorParams = {}
  let promptData = JSON.stringify({
    payload,
    model: profile.model,
    params: activeParams,
    msgNumbers,
    messageFlags,
    directorReviewed,
    directorAttempted,
    directorSystemPrompt,
    directorUserPrompt,
    directorOriginalMessage,
    directorResponse,
    directorResponseData,
    directorFailed,
    loreActivated: loreActivated || [],
    lorebooks: lorebooks || [],
    statusBlockDirectorAttempted,
    statusBlockDirectorSystemPrompt,
    statusBlockDirectorUserPrompt,
  })

  const sendResult = await sendChatCompletion({
    profile,
    messages: payload,
    signal,
    threadId,
    kind: isOOC ? 'ooc' : 'chat',
    charName,
    personaName,
    assistantSpeaker,
    personaMap,
    onToken: directorConfig ? undefined : onToken,
    onFinish,
    onStreamingStarted: ctx?.markStreaming,
    onActivity: ctx?.markActivity,
    onTiming: (ms) => {
      chatDurationMs = ms
    },
  })
  const content = sendResult.content
  let responseData = sendResult.response

  if (!content) {
    return {
      status: 'empty',
      content: '',
      promptData: null,
      responseData: null,
      apiDurationMs: null,
      directorReviewed: false,
      error: null,
    }
  }

  const trimMsgs = await getSetting('prompting.trimMessages')
  const trimWsAi = await getSetting('prompting.trimWhitespacesAi')
  let finalContent = trimMsgs ? trimLeadingTrailingNewlines(content) : content
  if (trimWsAi) finalContent = trimWhitespace(finalContent)

  if (directorConfig) {
    try {
      let writingInstructionContent = ''
      if (character?.writingInstruction) {
        const wi = await getWritingInstruction(Number(character.writingInstruction))
        writingInstructionContent = wi?.content || ''
      }
      const charName = character?.name || ''
      const userPersonaName = chatPersona?.name || ''
      const currentPersonaName = currentPersona?.name || userPersonaName
      const statusBlock = replaceVars(payloadStatusBlock, {
        charName,
        personaName: userPersonaName,
        currentPersonaName,
      })
      const prefixedMessage = await prefixAssistantMessage(content, {
        charName,
        personaName: userPersonaName,
        currentPersonaName,
      })
      const messagesTranscript = await buildMessagesWindowTranscript({
        baseMessages: apiMessages,
        responseContent: content,
        character,
        chatPersona,
        currentPersona,
        personaMap,
      })
      const templateVars = {
        message: prefixedMessage,
        message_response: prefixedMessage,
        message_system: payload.find((m) => m.role === 'system')?.content || '',
        message_user: messageUser,
        messagesTranscript,
        writingInstructions: writingInstructionContent,
        status_block: statusBlock,
        char: charName,
        user: userPersonaName,
        name: currentPersonaName,
      }
      const systemInstructions = await applyDirectorTemplate(
        directorConfig.systemInstructions,
        templateVars,
      )
      const userInstructions = await applyDirectorTemplate(
        directorConfig.userInstructions,
        templateVars,
      )
      const dPayload = buildDirectorMessages({ systemInstructions, userInstructions })

      directorAttempted = true
      directorSystemPrompt = systemInstructions
      directorUserPrompt = userInstructions
      directorOriginalMessage = content

      const dProfile = await getEffectiveProfileFor('director', character)
      if (!dProfile?.model) {
        throw new Error(i18n.t('chat:noProfileModel'))
      }

      showToast(i18n.t('chat:directorReviewing'), { type: 'info' })
      ctx?.setDirectorPhase?.(true)
      try {
        const reviewedResult = await sendChatCompletion({
          profile: dProfile,
          messages: dPayload,
          signal,
          threadId,
          kind: 'director',
          charName,
          personaName,
          assistantSpeaker,
          onToken,
          onFinish,
          onStreamingStarted: ctx?.markStreaming,
          onActivity: ctx?.markActivity,
          onTiming: (ms) => {
            directorDurationMs = ms
          },
        })
        const reviewed = reviewedResult.content
        if (reviewed) {
          directorReviewed = true
          directorResponse = reviewed
          directorResponseData = reviewedResult.response
          if (directorConfig.outputDirectorResponse) {
            finalContent = trimMsgs ? trimLeadingTrailingNewlines(reviewed) : reviewed
            if (trimWsAi) finalContent = trimWhitespace(finalContent)
            responseData = reviewedResult.response
          }
          promptData = JSON.stringify({
            payload,
            model: profile.model,
            params: activeParams,
            msgNumbers,
            messageFlags,
            directorReviewed,
            directorAttempted,
            directorSystemPrompt,
            directorUserPrompt,
            directorOriginalMessage,
            directorResponse,
            directorResponseData,
            directorFailed,
          })
        }
      } finally {
        ctx?.setDirectorPhase?.(false)
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err
      directorFailed = true
      directorResponse = err.message || 'Unknown error'
      promptData = JSON.stringify({
        payload,
        model: profile.model,
        params: activeParams,
        msgNumbers,
        messageFlags,
        directorReviewed,
        directorAttempted,
        directorSystemPrompt,
        directorUserPrompt,
        directorOriginalMessage,
        directorResponse,
        directorResponseData,
        directorFailed,
      })
      showToast(i18n.t('chat:directorFailed'), { type: 'warning' })
    }
  }

  const apiDurationMs =
    directorReviewed && chatDurationMs != null && directorDurationMs != null
      ? chatDurationMs + directorDurationMs
      : chatDurationMs

  if (isOOC) {
    const oocDelimiters = await getSetting('prompting.oocDelimiters')
    finalContent = stripOOCDelimiters(finalContent, oocDelimiters)
  }

  let directedStatusBlock = ''
  let statusBlockDirectorDurationMs = null
  let statusBlockDirectorFailed = false
  if (!isOOC) {
    const sbResult = await runStatusBlockDirector({
      character,
      chatPersona,
      currentPersona,
      threadId,
      message: finalContent,
      messageSystem: payload.find((m) => m.role === 'system')?.content || '',
      messageUser,
      messages: apiMessages,
      personaMap,
      signal,
      ctx,
      statusBlock: payloadStatusBlock,
    })
    if (sbResult?.status === 'success') {
      statusBlockDirectorAttempted = true
      if (sbResult.content?.trim()) {
        directedStatusBlock = sbResult.content
        statusBlockDirectorDurationMs = sbResult.apiDurationMs
        statusBlockDirectorSystemPrompt = sbResult.systemInstructions || ''
        statusBlockDirectorUserPrompt = sbResult.userInstructions || ''
        statusBlockDirectorModel = sbResult.directorModel || ''
        statusBlockDirectorParams = sbResult.directorParams || {}
      } else {
        statusBlockDirectorFailed = true
      }
    } else if (sbResult?.status === 'error') {
      statusBlockDirectorFailed = true
      showToast(i18n.t('chat:statusBlockDirectorFailed'), { type: 'warning' })
    }
  }

  return {
    status: 'success',
    content: finalContent,
    promptData,
    responseData,
    apiDurationMs,
    directorReviewed,
    statusBlock: directedStatusBlock.trim() ? directedStatusBlock : undefined,
    payloadStatusBlock,
    statusBlockDirectorDurationMs,
    statusBlockDirectorFailed,
    statusBlockDirectorAttempted,
    statusBlockDirectorSystemPrompt,
    statusBlockDirectorUserPrompt,
    statusBlockDirectorModel,
    statusBlockDirectorParams,
    error: null,
  }
}
