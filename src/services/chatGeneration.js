import { getEffectiveProfileFor } from './connectionProfiles'
import { getDirectorReviewConfig, buildDirectorMessages, applyDirectorTemplate } from './director'
import { buildChatRequestPayload, getActiveParams, sendChatCompletion } from './chatApi'
import { getWritingInstruction } from './writingInstructions'
import { getSetting } from './settings'
import { trimLeadingTrailingNewlines } from './messages'
import * as apiQueue from './apiQueue'
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

export function computeMessageFlags(entryTypes, msgNumbers, currentMsgs) {
  if (!entryTypes) return null
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
      const dbMsg = currentMsgs[num - 1]
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
      if (dbMsg?.summarizedAt) {
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
  isOOC,
  threadId,
  personaMap,
  signal,
  onToken,
  onFinish,
}) {
  const profile = isOOC ? await getEffectiveProfileFor('ooc') : await getEffectiveProfileFor('chat')

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

  const { payload, entryTypes, msgNumbers } = await buildChatRequestPayload({
    character,
    chatPersona,
    currentPersona,
    messages: currentMsgs,
    isFirstMessage,
    isOOC,
    threadId,
    personaMap,
  })

  const activeParams = getActiveParams(profile)
  const messageFlags = computeMessageFlags(entryTypes, msgNumbers, currentMsgs)
  let directorReviewed = false
  let directorAttempted = false
  let directorSystemPrompt = ''
  let directorUserPrompt = ''
  let directorResponse = ''
  let directorResponseData = null
  let directorFailed = false
  let chatDurationMs = null
  let directorDurationMs = null
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
    directorResponse,
    directorResponseData,
    directorFailed,
  })

  const sendResult = await sendChatCompletion({
    profile,
    messages: payload,
    signal,
    onToken: directorConfig ? undefined : onToken,
    onFinish,
    onStreamingStarted: apiQueue.markCurrentRequestStreaming,
    onActivity: apiQueue.markCurrentRequestActivity,
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
  let finalContent = trimMsgs ? trimLeadingTrailingNewlines(content) : content

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
      const templateVars = {
        message: content,
        message_response: content,
        message_system: payload.find((m) => m.role === 'system')?.content || '',
        message_user: payload.find((m) => m.role === 'user')?.content || '',
        writingInstructions: writingInstructionContent,
        char: charName,
        user: userPersonaName,
        name: currentPersonaName,
      }
      const systemInstructions = applyDirectorTemplate(
        directorConfig.systemInstructions,
        templateVars,
      )
      const userInstructions = applyDirectorTemplate(directorConfig.userInstructions, templateVars)
      const dPayload = buildDirectorMessages({ systemInstructions, userInstructions })

      directorAttempted = true
      directorSystemPrompt = systemInstructions
      directorUserPrompt = userInstructions

      const dProfile = await getEffectiveProfileFor('director')
      if (!dProfile?.model) {
        throw new Error(i18n.t('chat:noProfileModel'))
      }

      await apiQueue.waitForCooldown()
      showToast(i18n.t('chat:directorReviewing'), { type: 'info' })
      apiQueue.setCurrentRequestDirectorPhase(true)
      try {
        const reviewedResult = await sendChatCompletion({
          profile: dProfile,
          messages: dPayload,
          signal,
          onToken,
          onFinish,
          onStreamingStarted: apiQueue.markCurrentRequestStreaming,
          onActivity: apiQueue.markCurrentRequestActivity,
          onTiming: (ms) => {
            directorDurationMs = ms
          },
        })
        const reviewed = reviewedResult.content
        if (reviewed) {
          finalContent = trimMsgs ? trimLeadingTrailingNewlines(reviewed) : reviewed
          directorReviewed = true
          directorResponse = reviewed
          directorResponseData = reviewedResult.response
          responseData = reviewedResult.response
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
            directorResponse,
            directorResponseData,
            directorFailed,
          })
        }
      } finally {
        apiQueue.setCurrentRequestDirectorPhase(false)
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

  return {
    status: 'success',
    content: finalContent,
    promptData,
    responseData,
    apiDurationMs,
    directorReviewed,
    error: null,
  }
}
