import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, RefreshCw } from '../lib/icons'
import { useModal } from '../hooks/useModal'
import { showToast } from '../lib/toast'
import { useConfirm } from '../lib/confirm'
import Avatar from '../components/shared/Avatar'
import MarkdownTitle from '../components/shared/MarkdownTitle'
import ChatInputArea from '../components/chat/ChatInputArea'
import MessageBubble from '../components/chat/MessageBubble'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import { getThread, updateThread, forkThread } from '../services/threads'
import { getCharacter } from '../services/characters'
import { getAllPersonas, getPersona } from '../services/personas'
import {
  getMessagesByThread,
  createMessage,
  createAssistantMessage,
  createSummaryMarker,
  createAutoTitleMarker,
  updateMessage,
  deleteMessage,
  trimLeadingTrailingNewlines,
} from '../services/messages'
import { getWritingInstruction } from '../services/writingInstructions'
import { getEffectiveProfileFor } from '../services/connectionProfiles'
import {
  sendChatCompletion,
  buildMessagesPayload,
  buildOOCMessagesPayload,
  getActiveParams,
} from '../services/chatApi'
import { getSetting } from '../services/settings'
import { startGenerating, stopGenerating } from '../services/generatingState'
import * as apiQueue from '../services/apiQueue'
import { shouldAutoTitle, triggerAutoTitle } from '../services/autoTitle'
import {
  shouldTriggerSummarization,
  triggerSummarization,
  getUnsummarizedMessages,
  getMessagesForApiRequest,
} from '../services/summarization'
import { setBaseTitle } from '../services/titleManager'
import {
  isAwayFromThread,
  addUnread,
  clearUnread,
  markMessageRead,
  playNotificationSound,
} from '../services/unread'
import db from '../db'

function parseBundleEntries(bundleMessages) {
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

function rebuildFailedState(msgs) {
  const slots = {}
  for (const msg of msgs || []) {
    const entries = parseBundleEntries(msg.bundleMessages)
    if (!entries) continue
    let idx = 0
    if (msg.content) {
      const found = entries.findIndex((e) => e.content === msg.content)
      if (found !== -1) idx = found
    }
    slots[msg.id] = idx
  }
  return { slots }
}

function buildMsgNumbersArray(isFirstMessage, apiMessages, currentMsgs, payload) {
  const numMap = new Map(currentMsgs.map((m, i) => [m.id, i + 1]))
  const numbers = [null]
  if (isFirstMessage) {
    if (payload.length > 1) numbers.push(null)
  } else {
    for (const msg of apiMessages) {
      numbers.push(numMap.get(msg.id) || null)
    }
    if (payload.length > numbers.length) numbers.push(null)
  }
  return numbers
}

function computeMessageFlags(entryTypes, msgNumbers, currentMsgs) {
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

function ChatTitle({ title, chatTitleMarquee, onDoubleClick }) {
  const wrapperRef = useRef(null)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = wrapperRef.current
    if (el && chatTitleMarquee) {
      const overflows = el.scrollWidth > el.clientWidth
      if (overflows) {
        el.style.setProperty('--marquee-distance', `-${el.scrollWidth - el.clientWidth}px`)
      }
      setOverflows(overflows)
    } else {
      setOverflows(false)
    }
  }, [title, chatTitleMarquee])

  if (!chatTitleMarquee) {
    return (
      <span
        className="text-sm text-secondary truncate cursor-pointer"
        onDoubleClick={onDoubleClick}
      >
        <MarkdownTitle>{title}</MarkdownTitle>
      </span>
    )
  }

  return (
    <span
      ref={wrapperRef}
      className={`text-sm text-secondary marquee-wrapper ${overflows ? 'marquee-animate' : ''} cursor-pointer`}
      onDoubleClick={onDoubleClick}
    >
      <span className="marquee-text">
        <MarkdownTitle>{title}</MarkdownTitle>
      </span>
    </span>
  )
}

function ChatView() {
  const { threadId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation('chat')
  const { openModal } = useModal()
  const messagesEndRef = useRef(null)
  const scrollRef = useRef(null)
  const abortRef = useRef(null)
  const autoTitleAbortRef = useRef(null)
  const summarizationAbortRef = useRef(null)
  const generatingRef = useRef(false)
  const isAtBottomRef = useRef(true)
  const autoTriggeredRef = useRef(false)
  const currentThreadIdRef = useRef(threadId)
  const handleSendRef = useRef(null)
  const scrollCommits = useRef(0)
  const scrollStickyCleanupRef = useRef(null)
  const prevMessagesLengthRef = useRef(0)
  const messagesGrewRef = useRef(false)
  const messagesRef = useRef(null)
  const bundleSlotRef = useRef({})
  const failedIdsRef = useRef(new Set())
  const [thread, setThread] = useState(null)
  const [character, setCharacter] = useState(null)
  const [personaMap, setPersonaMap] = useState({})
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [queuedCount, setQueuedCount] = useState(0)
  const [summarizing, setSummarizing] = useState(false)
  const [streamingMsgId, setStreamingMsgId] = useState(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [noChatProfile, setNoChatProfile] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [charAvatarScale, setCharAvatarScale] = useState('1x')
  const [personaAvatarScale, setPersonaAvatarScale] = useState('1x')
  const [visibleStartIndex, setVisibleStartIndex] = useState(0)
  const [messageThreshold, setMessageThreshold] = useState(0)
  const [activeSlotIndices, setActiveSlotIndices] = useState({})
  const [isTabVisible, setIsTabVisible] = useState(true)
  const [systemAvatar, setSystemAvatar] = useState('')
  const [oocMessageRole, setOocMessageRole] = useState('system')
  const [chatTitleMarquee, setChatTitleMarquee] = useState(true)
  const scrollHeightBeforeRef = useRef(null)

  async function loadPersonas() {
    const list = await getAllPersonas()
    const map = {}
    list.forEach((p) => {
      map[p.id] = p
    })
    setPersonaMap(map)
  }

  async function loadData() {
    setLoading(true)
    try {
      let [thr, msgs] = await Promise.all([getThread(threadId), getMessagesByThread(threadId)])

      if (thr?.initialMessages?.length > 0 && msgs.length === 0) {
        const entries = thr.initialMessages.map((m) => ({
          content: m.content,
          promptData: null,
          origin: 'initial',
          createdAt: new Date().toISOString(),
        }))
        const msgId = await createAssistantMessage(threadId, entries[0].content)
        await updateMessage(msgId, { bundleMessages: JSON.stringify(entries) })
        await updateThread(threadId, { initialMessages: null })
        thr = await getThread(threadId)
        msgs = await getMessagesByThread(threadId)
      }

      setThread(thr)
      setMessages(msgs)

      const { slots } = rebuildFailedState(msgs)
      setActiveSlotIndices(slots)

      const threshold = Number(await getSetting('defaultMessageThreshold')) || 0
      setMessageThreshold(threshold)
      setVisibleStartIndex(threshold > 0 ? Math.max(0, msgs.length - threshold) : 0)

      let chr = null
      if (thr) {
        chr = await getCharacter(thr.characterId)
        setCharacter(chr)
      }
      const chatProfileId = await getSetting('requestKind.chat.profileId')
      setNoChatProfile(!chatProfileId)

      const [charScaleDefault, personaScaleDefault] = await Promise.all([
        getSetting('defaultCharacterAvatarScale'),
        getSetting('defaultUserPersonaAvatarScale'),
      ])
      setCharAvatarScale(chr?.characterAvatarScale || charScaleDefault || '1x')
      setPersonaAvatarScale(chr?.userPersonaAvatarScale || personaScaleDefault || '1x')

      const [sysAvatar, oocRole] = await Promise.all([
        getSetting('defaultSystemAvatar'),
        getSetting('prompting.oocMessageRole'),
      ])
      setSystemAvatar(sysAvatar || '')
      setOocMessageRole(oocRole || 'system')

      await loadPersonas()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const preventPullToRefresh = (e) => {
      if (e.touches && e.touches.length > 1) return // Allow multi-touch
      // Optional: only prevent near top
      const scrollEl = scrollRef.current
      if (scrollEl && scrollEl.scrollTop <= 0) {
        e.preventDefault()
      }
    }

    const chatContainer = scrollRef.current
    if (chatContainer) {
      chatContainer.addEventListener('touchstart', preventPullToRefresh, { passive: false })
      return () => chatContainer.removeEventListener('touchstart', preventPullToRefresh)
    }
  }, [])

  useEffect(() => {
    const prevId = currentThreadIdRef.current
    currentThreadIdRef.current = threadId

    if (prevId && Number(prevId) !== Number(threadId)) {
      generatingRef.current = false
    }

    scrollStickyCleanupRef.current?.()
    scrollStickyCleanupRef.current = null
    prevMessagesLengthRef.current = 0
    scrollCommits.current = 0
    setShowScrollButton(false)
    setGenerating(false)
    setStreamingMsgId(null)
    setActiveSlotIndices({})
    loadData()
  }, [threadId])

  useEffect(() => {
    setBaseTitle(thread?.title ? `Scenara - ${thread.title}` : 'Scenara')
  }, [thread?.title])

  useEffect(() => {
    function handleThreadsChanged() {
      getThread(threadId).then((thr) => {
        if (thr) setThread(thr)
      })
    }
    window.addEventListener('threads-changed', handleThreadsChanged)
    return () => window.removeEventListener('threads-changed', handleThreadsChanged)
  }, [threadId])

  useLayoutEffect(() => {
    if (messages.length === 0 || loading) return

    const grew = messages.length > prevMessagesLengthRef.current
    messagesGrewRef.current = grew
    prevMessagesLengthRef.current = messages.length

    if (!grew && scrollCommits.current > 0) return

    const el = scrollRef.current
    if (!el) return

    scrollCommits.current++
    if (scrollCommits.current === 1) {
      el.scrollTo({ top: el.scrollHeight })
      const initialAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 100
      isAtBottomRef.current = initialAtBottom
      setShowScrollButton(!initialAtBottom)
      if (initialAtBottom) {
        clearUnread(threadId)
        setMessages((prev) => prev.map((m) => ({ ...m, isUnread: false })))
      }

      let sticking = true
      let active = true
      let prevScrollHeight = el.scrollHeight

      function poll() {
        if (!active) return
        const currentScrollHeight = el.scrollHeight
        if (currentScrollHeight !== prevScrollHeight) {
          prevScrollHeight = currentScrollHeight
          if (sticking) {
            el.scrollTop = currentScrollHeight
          }
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 100
          setShowScrollButton(!atBottom)
        }
        requestAnimationFrame(poll)
      }
      requestAnimationFrame(poll)

      const settleTimer = setTimeout(() => {
        sticking = false
      }, 800)

      setTimeout(() => {
        active = false
      }, 2500)

      function onUserScroll() {
        sticking = false
      }

      el.addEventListener('wheel', onUserScroll, { passive: true })
      el.addEventListener('touchmove', onUserScroll, { passive: true })

      scrollStickyCleanupRef.current = () => {
        sticking = false
        active = false
        clearTimeout(settleTimer)
        el.removeEventListener('wheel', onUserScroll)
        el.removeEventListener('touchmove', onUserScroll)
      }
    }
  }, [messages, loading, threadId])

  useEffect(() => {
    if (messages.length > 0 && scrollCommits.current > 1 && messagesGrewRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    setVisibleStartIndex((prev) => Math.min(prev, messages.length))
  }, [messages])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    function onSettingsChanged(e) {
      if (e.detail?.key === 'defaultMessageThreshold') {
        const newThreshold = Number(e.detail.value) || 0
        setMessageThreshold(newThreshold)
        setVisibleStartIndex(
          newThreshold > 0 ? Math.max(0, messagesRef.current.length - newThreshold) : 0,
        )
      }
    }
    window.addEventListener('settings-changed', onSettingsChanged)
    return () => window.removeEventListener('settings-changed', onSettingsChanged)
  }, [])

  useEffect(() => {
    getSetting('chatTitleMarquee').then((val) => {
      setChatTitleMarquee(val !== false)
    })
    function onSettingsChanged(e) {
      if (e.detail?.key === 'chatTitleMarquee') {
        setChatTitleMarquee(e.detail.value !== false)
      }
    }
    window.addEventListener('settings-changed', onSettingsChanged)
    return () => window.removeEventListener('settings-changed', onSettingsChanged)
  }, [])

  useEffect(() => {
    function onPersonasChanged() {
      loadPersonas()
    }
    async function onCharactersChanged() {
      if (!thread) return
      const chr = await getCharacter(thread.characterId)
      setCharacter(chr)
      const [charScaleDefault, personaScaleDefault] = await Promise.all([
        getSetting('defaultCharacterAvatarScale'),
        getSetting('defaultUserPersonaAvatarScale'),
      ])
      setCharAvatarScale(chr?.characterAvatarScale || charScaleDefault || '1x')
      setPersonaAvatarScale(chr?.userPersonaAvatarScale || personaScaleDefault || '1x')
    }
    window.addEventListener('personas-changed', onPersonasChanged)
    window.addEventListener('characters-changed', onCharactersChanged)
    return () => {
      window.removeEventListener('personas-changed', onPersonasChanged)
      window.removeEventListener('characters-changed', onCharactersChanged)
    }
  }, [thread])

  useEffect(() => {
    if (loading || !character || noChatProfile) return
    if (
      !autoTriggeredRef.current &&
      messages.length === 0 &&
      !thread?.initialMessages?.length &&
      character.firstMessage
    ) {
      autoTriggeredRef.current = true
      handleSendRef.current?.('', null, false)
    }
  }, [loading, character, noChatProfile, thread?.initialMessages])

  useEffect(() => {
    function handleVisibility() {
      setIsTabVisible(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => {
    handleSendRef.current = handleSend
  })

  useEffect(() => {
    const handler = () => {
      setQueuedCount(apiQueue.getThreadQueueCount(threadId))
    }
    handler()
    const unsub = apiQueue.subscribe(handler)
    window.addEventListener('api-queue-changed', handler)
    return () => {
      unsub()
      window.removeEventListener('api-queue-changed', handler)
    }
  }, [threadId])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 100
    setShowScrollButton(!atBottom)
    isAtBottomRef.current = atBottom
    if (atBottom) {
      clearUnread(threadId)
      setMessages((prev) => prev.map((m) => ({ ...m, isUnread: false })))
    }
  }, [threadId])

  useEffect(() => {
    const container = scrollRef.current
    if (!container || messages.length === 0) return

    if (messages[0].threadId !== undefined && messages[0].threadId !== Number(threadId)) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target
          const msgId = Number(el.dataset.messageId)
          if (!msgId) return
          observer.unobserve(el)
          markMessageRead(msgId, threadId)
          setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, isUnread: false } : m)))
        })
      },
      { root: container, threshold: 0.3 },
    )

    const unreadElements = container.querySelectorAll('[data-message-id][data-unread="true"]')

    const unreadMsgIds = new Set()
    messages.forEach((m) => {
      if (m.isUnread) unreadMsgIds.add(m.id)
    })
    const validElements = Array.from(unreadElements).filter((el) =>
      unreadMsgIds.has(Number(el.dataset.messageId)),
    )
    validElements.forEach((el) => observer.observe(el))

    if (isTabVisible && validElements.length > 0) {
      const containerRect = container.getBoundingClientRect()
      const visibleIds = []
      validElements.forEach((el) => {
        const rect = el.getBoundingClientRect()
        if (rect.top < containerRect.bottom && rect.bottom > containerRect.top) {
          observer.unobserve(el)
          const msgId = Number(el.dataset.messageId)
          if (msgId) visibleIds.push(msgId)
        }
      })
      if (visibleIds.length > 0) {
        if (visibleIds.length === validElements.length) {
          clearUnread(threadId)
        } else {
          visibleIds.forEach((msgId) => markMessageRead(msgId, threadId))
        }
        setMessages((prev) =>
          prev.map((m) => (visibleIds.includes(m.id) ? { ...m, isUnread: false } : m)),
        )
      }
    }

    return () => observer.disconnect()
  }, [messages, threadId, isTabVisible])

  function scrollToBottom() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    setShowScrollButton(false)
  }

  function handleLoadEarlier() {
    if (!scrollRef.current || visibleStartIndex <= 0) return
    scrollHeightBeforeRef.current = scrollRef.current.scrollHeight
    const chunkSize = messageThreshold || 50
    setVisibleStartIndex((prev) => Math.max(0, prev - chunkSize))
  }

  useLayoutEffect(() => {
    if (scrollHeightBeforeRef.current !== null && scrollRef.current) {
      const el = scrollRef.current
      el.scrollTop += el.scrollHeight - scrollHeightBeforeRef.current
      scrollHeightBeforeRef.current = null
    }
  })

  useEffect(() => {
    const ids = new Set()
    for (const msg of messages) {
      const entries = parseBundleEntries(msg.bundleMessages)
      if (!entries) continue
      const activeIdx = activeSlotIndices[msg.id]
      if (activeIdx === undefined || activeIdx < 0 || activeIdx >= entries.length) continue
      if (entries[activeIdx]?.isError) {
        ids.add(msg.id)
      }
    }
    failedIdsRef.current = ids
  }, [messages, activeSlotIndices])

  async function handleCancel() {
    const confirmCancellation = await getSetting('cancellationConfirmation')
    if (confirmCancellation) {
      openModal('cancelConfirm', { threadId })
      return
    }
    apiQueue.cancelThreadRequests(threadId)
  }

  function withoutFailedMessages(msgs) {
    const ids = failedIdsRef.current
    return ids.size > 0 ? msgs.filter((m) => !ids.has(m.id)) : msgs
  }

  async function doChatRequest(
    isFirstMessage,
    currentMsgs,
    chatPersona,
    currentPersona,
    isOOC = false,
    signal,
  ) {
    currentMsgs = withoutFailedMessages(currentMsgs)
    const profile = isOOC
      ? await getEffectiveProfileFor('ooc')
      : await getEffectiveProfileFor('chat')
    if (!profile?.model) {
      showToast(t('noProfileModel'), { type: 'error' })
      return
    }

    const includeOOC = character?.includeOOC !== false
    const keepMessages = Number(
      character?.messagesToKeep ?? (await getSetting('defaultMessagesToKeep')) ?? 0,
    )
    const apiMessages = getMessagesForApiRequest(currentMsgs, {
      includeOOC,
      keepMessages,
    })
    const latestThread = await getThread(threadId)
    const memoryHeader = await getSetting('prompting.apiRequestSectionHeaders.memories')
    const memoryText = latestThread?.memory || ''

    let payload
    let entryTypes = null
    let msgNumbers = null
    if (isOOC) {
      const oocSystemInstructions = await getSetting('prompting.oocSystem')
      const oocUserInstructions = await getSetting('prompting.oocUser')
      const characterPromptHeader = await getSetting(
        'prompting.apiRequestSectionHeaders.characterPrompt',
      )
      const messagesHeader = await getSetting('prompting.apiRequestSectionHeaders.messages')
      const systemRolePrefix = await getSetting('prompting.systemRolePrefix')
      const assistantRolePrefix = await getSetting('prompting.assistantRolePrefix')
      const userRolePrefix = await getSetting('prompting.userRolePrefix')
      const userRolePrefixWithPersona = await getSetting('prompting.userRolePrefixWithPersona')
      const systemRolePrefixOoc = await getSetting('prompting.systemRolePrefixOoc')
      const assistantRolePrefixOoc = await getSetting('prompting.assistantRolePrefixOoc')
      const userRolePrefixOoc = await getSetting('prompting.userRolePrefixOoc')

      const lastUserMsg =
        currentMsgs.length > 0 && currentMsgs[currentMsgs.length - 1].role === 'user'
          ? currentMsgs[currentMsgs.length - 1].content
          : ''
      const transcriptMsgs = currentMsgs.slice(0, -1)

      const oocResult = await buildOOCMessagesPayload({
        character,
        chatPersona,
        currentPersona,
        messages: apiMessages.slice(0, -1),
        userMessage: lastUserMsg,
        personaMap,
        memoryText,
        memoryHeader,
        oocSettings: {
          oocSystemInstructions,
          oocUserInstructions,
          characterPromptHeader,
          messagesHeader,
          systemRolePrefix,
          assistantRolePrefix,
          userRolePrefix,
          userRolePrefixWithPersona,
          systemRolePrefixOoc,
          assistantRolePrefixOoc,
          userRolePrefixOoc,
        },
      })
      payload = oocResult.payload
      entryTypes = oocResult.entryTypes
    } else {
      let writingInstruction = null
      if (character?.writingInstruction) {
        writingInstruction = await getWritingInstruction(Number(character.writingInstruction))
      }

      const settings = {
        firstMessageRole: await getSetting('prompting.firstMessageRole'),
        firstMessagePrompt: await getSetting('prompting.firstMessagePrompt'),
        continueRole: await getSetting('prompting.continueRole'),
        continuePrompt: await getSetting('prompting.continuePrompt'),
        personaInjectionTemplate: await getSetting('prompting.personaInjectionTemplate'),
        writingInjectionTiming: await getSetting('prompting.writingInjectionTiming'),
        writingPlacement: await getSetting('prompting.writingPlacement'),
        writingMessageRole: await getSetting('prompting.writingMessageRole'),
        personaInjectionTiming: await getSetting('prompting.personaInjectionTiming'),
        personaInjectionPlacement: await getSetting('personaInjectionPlacement'),
        personaInjectionMessageRole: await getSetting('personaInjectionMessageRole'),
      }

      const chatResult = await buildMessagesPayload({
        character,
        chatPersona,
        currentPersona,
        messages: apiMessages,
        isFirstMessage,
        settings,
        writingInstruction,
        memoryText,
        memoryHeader,
      })
      payload = chatResult.payload
      entryTypes = chatResult.entryTypes
      msgNumbers = buildMsgNumbersArray(isFirstMessage, apiMessages, currentMsgs, payload)
    }

    const activeParams = getActiveParams(profile)
    const messageFlags = computeMessageFlags(entryTypes, msgNumbers, currentMsgs)
    const promptData = JSON.stringify({
      payload,
      model: profile.model,
      params: activeParams,
      msgNumbers,
      messageFlags,
    })

    const assistantMsgId = await createAssistantMessage(threadId, '', null, isOOC)
    await updateMessage(assistantMsgId, { promptData })
    if (Number(currentThreadIdRef.current) === Number(threadId)) {
      setStreamingMsgId(assistantMsgId)
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          threadId: Number(threadId),
          role: 'assistant',
          content: '',
          isOOC,
          createdAt: new Date(),
        },
      ])
    }

    let completedNormally = false

    try {
      const content = await sendChatCompletion({
        profile,
        messages: payload,
        signal,
        onToken: (fullContent) => {
          updateMessage(assistantMsgId, { content: fullContent })
          if (Number(currentThreadIdRef.current) === Number(threadId)) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullContent } : m)),
            )
          }
        },
        onFinish: (reason) => {
          if (reason === 'length' && Number(currentThreadIdRef.current) === Number(threadId)) {
            showToast(t('responseTruncated', { ns: 'chat' }), { type: 'warning' })
          }
        },
      })

      if (!content) {
        const failedEntry = {
          content: '',
          promptData: null,
          isError: true,
          error: null,
          createdAt: new Date().toISOString(),
        }
        await updateMessage(assistantMsgId, {
          content: '',
          bundleMessages: JSON.stringify([failedEntry]),
        })
        const newFailed = new Set(failedIdsRef.current)
        newFailed.add(assistantMsgId)
        failedIdsRef.current = newFailed
      }

      if (content) {
        const trimMsgs = await getSetting('prompting.trimMessages')
        const finalContent = trimMsgs ? trimLeadingTrailingNewlines(content) : content
        await updateMessage(assistantMsgId, { content: finalContent })
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: finalContent } : m)),
          )
          showToast(t('messageUpdated'), { type: 'success' })
        }
        completedNormally = true
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        await deleteMessage(assistantMsgId)
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId))
        }
        throw err
      } else {
        const failedEntry = {
          content: err.message || '',
          promptData: null,
          isError: true,
          error: err.message || null,
          createdAt: new Date().toISOString(),
        }
        await updateMessage(assistantMsgId, {
          content: err.message || '',
          bundleMessages: JSON.stringify([failedEntry]),
        })
        const msgs = await getMessagesByThread(threadId)
        if (Number(currentThreadIdRef.current) === Number(threadId)) setMessages(msgs)
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          showToast(err.message, { type: 'error' })
        }
        const newFailed = new Set(failedIdsRef.current)
        newFailed.add(assistantMsgId)
        failedIdsRef.current = newFailed
        completedNormally = true
      }
    } finally {
      if (Number(currentThreadIdRef.current) === Number(threadId)) {
        setStreamingMsgId(null)
      }
      if (completedNormally) {
        try {
          const away = isAwayFromThread(threadId) || !isAtBottomRef.current
          if (away) {
            await addUnread(threadId, assistantMsgId)
            if (Number(currentThreadIdRef.current) === Number(threadId)) {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, isUnread: true } : m)),
              )
            }
            const soundEnabled = await getSetting('unreadSound')
            if (soundEnabled) playNotificationSound()
          }
        } catch {}
      }
    }
  }

  async function handleSend(text, personaId, isOOC, autoReply = true) {
    if (generatingRef.current) return
    generatingRef.current = true
    setGenerating(true)
    startGenerating(threadId)

    try {
      let currentMsgs = messages
      let chatPersona = null

      if (thread?.personaId) {
        chatPersona = await getPersona(thread.personaId)
      }

      const isFirstMessage = messages.length === 0

      if (text) {
        const trimMsgs = await getSetting('prompting.trimMessages')
        const userText = trimMsgs ? trimLeadingTrailingNewlines(text) : text
        await createMessage(threadId, 'user', userText, personaId, isOOC)
        currentMsgs = await getMessagesByThread(threadId)
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          setMessages(currentMsgs)
        }
      }

      if (text && !autoReply) {
        generatingRef.current = false
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          setGenerating(false)
        }
        stopGenerating(threadId)
        return
      }

      const currentPersona = personaId ? await getPersona(personaId) : null
      const abortController = new AbortController()
      abortRef.current = abortController

      await apiQueue.enqueue({
        threadId,
        type: 'chat',
        signal: abortController.signal,
        controller: abortController,
        execute: async () => {
          return await doChatRequest(
            isFirstMessage,
            currentMsgs,
            chatPersona,
            currentPersona,
            isOOC,
            abortController.signal,
          )
        },
      }).promise

      if (Number(currentThreadIdRef.current) !== Number(threadId)) return
      const msgs = await getMessagesByThread(threadId)
      setMessages(msgs)
      const nonFailedMsgs = withoutFailedMessages(msgs)
      generatingRef.current = false
      setGenerating(false)
      stopGenerating(threadId)

      const thr = await getThread(threadId)
      const chr = await getCharacter(thr.characterId)

      if (await shouldAutoTitle(thr, chr, nonFailedMsgs)) {
        showToast(t('autoTitleGenerating'), { type: 'info' })
        const atAbort = new AbortController()
        autoTitleAbortRef.current = atAbort
        try {
          await apiQueue.enqueue({
            threadId,
            type: 'autoTitle',
            signal: atAbort.signal,
            controller: atAbort,
            execute: async () => {
              return await triggerAutoTitle({
                thread: thr,
                character: chr,
                messages: nonFailedMsgs,
                personaMap,
                signal: atAbort.signal,
              })
            },
          }).promise
          const updatedThr = await getThread(threadId)
          setThread((prev) => ({ ...prev, title: updatedThr.title, autoTitleGenerated: true }))
          showToast(t('autoTitleGenerated'), { type: 'success' })

          const markerEnabled = await getSetting('autoTitleMarker')
          if (markerEnabled) {
            const postMsgs = await getMessagesByThread(threadId)
            if (postMsgs.length > 0) {
              const lastMsg = postMsgs[postMsgs.length - 1]
              if (!lastMsg.isAutoTitleMarker) {
                await createAutoTitleMarker(threadId, lastMsg.createdAt)
                const updated = await getMessagesByThread(threadId)
                if (Number(currentThreadIdRef.current) === Number(threadId)) {
                  setMessages(updated)
                }
              }
            }
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            showToast(err.message, { type: 'error' })
          }
        } finally {
          autoTitleAbortRef.current = null
        }
      }

      if (
        character &&
        (await shouldTriggerSummarization({
          character,
          messages: nonFailedMsgs,
          includeOOC: character.includeOOC !== false,
        }))
      ) {
        const currentThread = await getThread(threadId)
        const unsummarizedMessages = getUnsummarizedMessages(nonFailedMsgs, {
          includeOOC: character.includeOOC !== false,
        })
        if (unsummarizedMessages.length > 0) {
          const summAbort = new AbortController()
          summarizationAbortRef.current = summAbort
          setSummarizing(true)
          showToast('Generating summary', { type: 'info' })
          try {
            const summary = await apiQueue.enqueue({
              threadId,
              type: 'summarization',
              signal: summAbort.signal,
              controller: summAbort,
              execute: async () => {
                return await triggerSummarization({
                  thread: currentThread,
                  character,
                  messages: nonFailedMsgs,
                  personaMap,
                  signal: summAbort.signal,
                  currentPersona: null,
                })
              },
            }).promise
            if (summary) {
              setThread((prev) => (prev ? { ...prev, memory: summary } : prev))
              showToast('Summary generated', { type: 'success' })

              const markerEnabled = await getSetting('summarizationMarker')
              if (markerEnabled) {
                const postMsgs = await getMessagesByThread(threadId)
                let lastSummarizedIdx = -1
                for (let i = postMsgs.length - 1; i >= 0; i--) {
                  if (postMsgs[i].summarizedAt) {
                    lastSummarizedIdx = i
                    break
                  }
                }
                if (lastSummarizedIdx !== -1 && !postMsgs[lastSummarizedIdx + 1]?.isSummaryMarker) {
                  await createSummaryMarker(threadId, postMsgs[lastSummarizedIdx].createdAt)
                  const updated = await getMessagesByThread(threadId)
                  if (Number(currentThreadIdRef.current) === Number(threadId)) {
                    setMessages(updated)
                  }
                }
              }
            }
          } catch (err) {
            if (err.name !== 'AbortError') {
              showToast(err.message || 'Summarization failed', { type: 'error' })
            }
          } finally {
            summarizationAbortRef.current = null
            setSummarizing(false)
          }
        }
      }
    } catch {
      // doChatRequest re-throws AbortError on cancel — handled silently
    } finally {
      generatingRef.current = false
      if (Number(currentThreadIdRef.current) === Number(threadId)) {
        setGenerating(false)
      }
      stopGenerating(threadId)
    }
  }

  async function handleBundleNavigate(messageId, slotIndex) {
    const msg = messages.find((m) => m.id === messageId)
    const entries = parseBundleEntries(msg?.bundleMessages)
    if (!entries || slotIndex < 0 || slotIndex >= entries.length) return
    const entry = entries[slotIndex]
    await updateMessage(messageId, { content: entry.content, promptData: entry.promptData })
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, content: entry.content, promptData: entry.promptData } : m,
      ),
    )
    setActiveSlotIndices((prev) => ({ ...prev, [messageId]: slotIndex }))
  }

  async function handleRegenerate(messageId) {
    const regenConfirm = await getSetting('regenerationConfirmation')
    if (regenConfirm) {
      const ok = await confirm({
        title: t('regenerationConfirmTitle'),
        message: t('regenerationConfirmMessage'),
        confirmLabel: t('regenerate'),
        cancelLabel: t('cancel'),
      })
      if (!ok) return
    }

    if (generatingRef.current) return
    generatingRef.current = true
    if (Number(currentThreadIdRef.current) === Number(threadId)) {
      setGenerating(true)
    }
    startGenerating(threadId)

    let slotIndex = 0
    let completedNormally = false
    let regenEntries
    try {
      const idx = messages.findIndex((m) => m.id === messageId)
      if (idx === -1) return

      const msg = messages[idx]

      regenEntries = parseBundleEntries(msg.bundleMessages)
      if (!regenEntries) {
        regenEntries = [{ content: msg.content, promptData: msg.promptData || null }]
      }

      slotIndex = regenEntries.length
      regenEntries.push({ content: '', promptData: null, createdAt: new Date().toISOString() })
      if (Number(currentThreadIdRef.current) === Number(threadId)) {
        setActiveSlotIndices((prev) => ({ ...prev, [messageId]: slotIndex }))
      }
      const bundleJson = JSON.stringify(regenEntries)

      await updateMessage(messageId, { bundleMessages: bundleJson, content: '' })
      if (Number(currentThreadIdRef.current) === Number(threadId)) {
        setStreamingMsgId(messageId)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, bundleMessages: bundleJson, content: '' } : m,
          ),
        )
      }

      let currentMsgs = messages.slice(0, idx)
      currentMsgs = withoutFailedMessages(currentMsgs)
      let chatPersona = null
      if (thread?.personaId) {
        chatPersona = await getPersona(thread.personaId)
      }

      const isFirstMessage = currentMsgs.length === 0 && character?.firstMessage
      const isOOCRegen = !!msg.isOOC

      const profile = isOOCRegen
        ? await getEffectiveProfileFor('ooc')
        : await getEffectiveProfileFor('chat')
      if (!profile?.model) {
        showToast(t('noProfileModel'), { type: 'error' })
        return
      }

      let payload
      let entryTypes = null
      let promptDataStr
      let msgNumbers = null

      if (isOOCRegen) {
        const oocSystemInstructions = await getSetting('prompting.oocSystem')
        const oocUserInstructions = await getSetting('prompting.oocUser')
        const characterPromptHeader = await getSetting(
          'prompting.apiRequestSectionHeaders.characterPrompt',
        )
        const messagesHeader = await getSetting('prompting.apiRequestSectionHeaders.messages')
        const systemRolePrefix = await getSetting('prompting.systemRolePrefix')
        const assistantRolePrefix = await getSetting('prompting.assistantRolePrefix')
        const userRolePrefix = await getSetting('prompting.userRolePrefix')
        const userRolePrefixWithPersona = await getSetting('prompting.userRolePrefixWithPersona')
        const systemRolePrefixOoc = await getSetting('prompting.systemRolePrefixOoc')
        const assistantRolePrefixOoc = await getSetting('prompting.assistantRolePrefixOoc')
        const userRolePrefixOoc = await getSetting('prompting.userRolePrefixOoc')

        const includeOOCRegen = character?.includeOOC !== false
        const keepMessagesRegen = Number(
          character?.messagesToKeep ?? (await getSetting('defaultMessagesToKeep')) ?? 0,
        )
        const apiMessagesRegen = getMessagesForApiRequest(currentMsgs, {
          includeOOC: includeOOCRegen,
          keepMessages: keepMessagesRegen,
        })
        const memoryHeaderRegen = await getSetting('prompting.apiRequestSectionHeaders.memories')
        const memoryTextRegen = thread?.memory || ''

        const lastUserMsg =
          currentMsgs.length > 0 && currentMsgs[currentMsgs.length - 1].role === 'user'
            ? currentMsgs[currentMsgs.length - 1].content
            : ''

        const oocResultRegen = await buildOOCMessagesPayload({
          character,
          chatPersona,
          currentPersona: null,
          messages: apiMessagesRegen.slice(0, -1),
          userMessage: lastUserMsg,
          personaMap,
          memoryText: memoryTextRegen,
          memoryHeader: memoryHeaderRegen,
          oocSettings: {
            oocSystemInstructions,
            oocUserInstructions,
            characterPromptHeader,
            messagesHeader,
            systemRolePrefix,
            assistantRolePrefix,
            userRolePrefix,
            userRolePrefixWithPersona,
            systemRolePrefixOoc,
            assistantRolePrefixOoc,
            userRolePrefixOoc,
          },
        })
        payload = oocResultRegen.payload
        entryTypes = oocResultRegen.entryTypes
      } else {
        let writingInstruction = null
        if (character?.writingInstruction) {
          writingInstruction = await getWritingInstruction(Number(character.writingInstruction))
        }

        const settings = {
          firstMessageRole: await getSetting('prompting.firstMessageRole'),
          firstMessagePrompt: await getSetting('prompting.firstMessagePrompt'),
          continueRole: await getSetting('prompting.continueRole'),
          continuePrompt: await getSetting('prompting.continuePrompt'),
          personaInjectionTemplate: await getSetting('prompting.personaInjectionTemplate'),
          writingInjectionTiming: await getSetting('prompting.writingInjectionTiming'),
          writingPlacement: await getSetting('prompting.writingPlacement'),
          writingMessageRole: await getSetting('prompting.writingMessageRole'),
          personaInjectionTiming: await getSetting('prompting.personaInjectionTiming'),
          personaInjectionPlacement: await getSetting('personaInjectionPlacement'),
          personaInjectionMessageRole: await getSetting('personaInjectionMessageRole'),
        }

        const includeOOCRegen = character?.includeOOC !== false
        const keepMessagesRegen = Number(
          character?.messagesToKeep ?? (await getSetting('defaultMessagesToKeep')) ?? 0,
        )
        const apiMessagesRegen = getMessagesForApiRequest(currentMsgs, {
          includeOOC: includeOOCRegen,
          keepMessages: keepMessagesRegen,
        })
        const memoryHeaderRegen = await getSetting('prompting.apiRequestSectionHeaders.memories')
        const memoryTextRegen = thread?.memory || ''

        const chatResultRegen = await buildMessagesPayload({
          character,
          chatPersona,
          currentPersona: null,
          messages: apiMessagesRegen,
          isFirstMessage,
          settings,
          writingInstruction,
          memoryText: memoryTextRegen,
          memoryHeader: memoryHeaderRegen,
        })
        payload = chatResultRegen.payload
        entryTypes = chatResultRegen.entryTypes
        msgNumbers = buildMsgNumbersArray(isFirstMessage, apiMessagesRegen, currentMsgs, payload)
      }

      const activeParams = getActiveParams(profile)
      const messageFlags = computeMessageFlags(entryTypes, msgNumbers, currentMsgs)
      promptDataStr = JSON.stringify({
        payload,
        model: profile.model,
        params: activeParams,
        msgNumbers,
        messageFlags,
      })

      regenEntries[slotIndex].promptData = promptDataStr
      await updateMessage(messageId, {
        bundleMessages: JSON.stringify(regenEntries),
        promptData: promptDataStr,
      })

      const regenAbortController = new AbortController()
      abortRef.current = regenAbortController

      const content = await apiQueue.enqueue({
        threadId,
        type: 'regenerate',
        signal: regenAbortController.signal,
        controller: regenAbortController,
        execute: async () => {
          return await sendChatCompletion({
            profile,
            messages: payload,
            signal: regenAbortController.signal,
            onToken: (fullContent) => {
              updateMessage(messageId, { content: fullContent })
              if (Number(currentThreadIdRef.current) === Number(threadId)) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === messageId ? { ...m, content: fullContent } : m)),
                )
              }
            },
            onFinish: (reason) => {
              if (reason === 'length' && Number(currentThreadIdRef.current) === Number(threadId)) {
                showToast(t('responseTruncated', { ns: 'chat' }), { type: 'warning' })
              }
            },
          })
        },
      }).promise

      if (!content) {
        const dbMsg = await db.messages.get(Number(messageId))
        const finalEntries = parseBundleEntries(dbMsg?.bundleMessages) || regenEntries
        if (finalEntries[slotIndex]) {
          finalEntries[slotIndex].isError = true
          finalEntries[slotIndex].error = null
        }
        await updateMessage(messageId, { bundleMessages: JSON.stringify(finalEntries) })
      }

      if (content) {
        const trimMsgs = await getSetting('prompting.trimMessages')
        const finalContent = trimMsgs ? trimLeadingTrailingNewlines(content) : content
        const dbMsg = await db.messages.get(Number(messageId))
        const finalEntries = parseBundleEntries(dbMsg?.bundleMessages) || regenEntries
        if (finalEntries[slotIndex]) {
          finalEntries[slotIndex].content = finalContent
          finalEntries[slotIndex].promptData = promptDataStr
          finalEntries[slotIndex].isError = false
          finalEntries[slotIndex].error = null
        }
        await updateMessage(messageId, {
          bundleMessages: JSON.stringify(finalEntries),
          content: finalContent,
          promptData: promptDataStr,
        })
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    content: finalContent,
                    bundleMessages: JSON.stringify(finalEntries),
                    promptData: promptDataStr,
                  }
                : m,
            ),
          )
          setActiveSlotIndices((prev) => ({ ...prev, [messageId]: slotIndex }))
          showToast(t('messageUpdated'), { type: 'success' })
        }
        completedNormally = true
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        if (regenEntries) {
          regenEntries.pop()
          const cleanedBundle = JSON.stringify(regenEntries)
          await updateMessage(messageId, { bundleMessages: cleanedBundle })
          if (Number(currentThreadIdRef.current) === Number(threadId)) {
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? { ...m, bundleMessages: cleanedBundle } : m)),
            )
          }
        }
      } else {
        const dbMsg = await db.messages.get(Number(messageId))
        const finalEntries = parseBundleEntries(dbMsg?.bundleMessages) || regenEntries
        if (finalEntries[slotIndex]) {
          finalEntries[slotIndex].isError = true
          finalEntries[slotIndex].error = err.message || null
          finalEntries[slotIndex].content = err.message || finalEntries[slotIndex].content || ''
        }
        await updateMessage(messageId, {
          bundleMessages: JSON.stringify(finalEntries),
          content: finalEntries[slotIndex]?.content ?? '',
        })
        const msgs = await getMessagesByThread(threadId)
        if (Number(currentThreadIdRef.current) === Number(threadId)) setMessages(msgs)
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          showToast(err.message, { type: 'error' })
        }
        completedNormally = true
      }
    } finally {
      if (Number(currentThreadIdRef.current) === Number(threadId)) {
        setStreamingMsgId(null)
      }
      generatingRef.current = false
      if (Number(currentThreadIdRef.current) === Number(threadId)) {
        setGenerating(false)
      }
      stopGenerating(threadId)
      if (completedNormally) {
        try {
          const away = isAwayFromThread(threadId) || !isAtBottomRef.current
          if (away) {
            await addUnread(threadId, messageId)
            if (Number(currentThreadIdRef.current) === Number(threadId)) {
              setMessages((prev) =>
                prev.map((m) => (m.id === messageId ? { ...m, isUnread: true } : m)),
              )
            }
            const soundEnabled = await getSetting('unreadSound')
            if (soundEnabled) playNotificationSound()
          }
        } catch {}
      }
    }
  }

  async function handleEditMessage(id, content) {
    const trimMsgs = await getSetting('prompting.trimMessages')
    const finalContent = trimMsgs ? trimLeadingTrailingNewlines(content) : content
    const msg = messages.find((m) => m.id === id)
    let entries = parseBundleEntries(msg?.bundleMessages)
    if (!entries) {
      entries = [{ content: msg.content, promptData: msg.promptData || null }]
    }
    entries.push({
      content: finalContent,
      promptData: null,
      origin: 'edit',
      createdAt: new Date().toISOString(),
    })
    await updateMessage(id, { bundleMessages: JSON.stringify(entries), content: finalContent })
    const msgs = await getMessagesByThread(threadId)
    setMessages(msgs)
    setActiveSlotIndices((prev) => ({ ...prev, [id]: entries.length - 1 }))
    showToast(t('messageUpdated'), { type: 'success' })
  }

  async function handleDeleteMessage(id) {
    setConfirmDeleteId(null)
    const msg = messages.find((m) => m.id === id)
    const entries = parseBundleEntries(msg?.bundleMessages)
    if (entries && entries.length > 1) {
      const idx =
        activeSlotIndices[id] !== undefined
          ? activeSlotIndices[id]
          : entries.findIndex((e) => e.content === msg.content)
      const removeIdx = idx !== -1 ? idx : 0
      entries.splice(removeIdx, 1)
      const newIdx = Math.min(removeIdx, entries.length - 1)
      const newContent = entries[newIdx].content
      const newPromptData = entries[newIdx].promptData
      await updateMessage(id, {
        bundleMessages: JSON.stringify(entries),
        content: newContent,
        promptData: newPromptData,
      })
      setActiveSlotIndices((prev) => ({ ...prev, [id]: newIdx }))
      const msgs = await getMessagesByThread(threadId)
      setMessages(msgs)
      showToast(t('messageDeleted'), { type: 'success' })
      return
    }
    setActiveSlotIndices((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    await deleteMessage(id)
    const msgs = await getMessagesByThread(threadId)
    setMessages(msgs)
    showToast(t('messageDeleted'), { type: 'success' })
  }

  const { confirm } = useConfirm()

  async function handleForkMessage(messageId) {
    const ok = await confirm({
      title: t('forkConfirmTitle'),
      message: t('forkConfirmMessage'),
      confirmLabel: t('fork'),
      cancelLabel: t('cancel'),
    })
    if (!ok) return
    const newId = await forkThread(threadId, messageId)
    navigate(`/chat/${newId}`)
  }

  function getAvatarSrc(msg) {
    if (msg.isOOC && msg.role === 'user') return '👤'
    if (msg.isOOC) return systemAvatar || null
    if (msg.role === 'user') return personaMap[msg.personaId]?.avatar || null
    return character?.avatar || null
  }

  function getAvatarScale(msg) {
    return msg.role === 'user' ? personaAvatarScale : charAvatarScale
  }

  function getMessageName(msg) {
    if (msg.isOOC && msg.role === 'user') return t('oocLabel')
    if (msg.isOOC) return oocMessageRole.toUpperCase()
    if (msg.role === 'user') return personaMap[msg.personaId]?.name || null
    return character?.name || null
  }

  const deletedMsgNumber = confirmDeleteId
    ? messages.findIndex((m) => m.id === confirmDeleteId) + 1
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary text-sm">{t('loading')}</p>
      </div>
    )
  }

  if (!thread) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary text-sm">{t('placeholder')}</p>
      </div>
    )
  }

  if (noChatProfile) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <p className="text-secondary text-sm text-center max-w-md">{t('noChatProfile')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto relative pb-4">
        <div className="sticky top-0 z-10 bg-surface flex items-center justify-between px-4 md:px-8 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            {character && (
              <Avatar
                src={character.avatar}
                size="sm"
                className="flex-shrink-0"
                onClick={() =>
                  openModal('imageViewer', { src: character.avatar, modalSize: 'fullscreen' })
                }
              />
            )}
            <div className="flex items-center gap-2 min-w-0">
              {character && <h1 className="font-semibold text-text shrink-0">{character.name}</h1>}
              <ChatTitle
                title={thread.title}
                chatTitleMarquee={chatTitleMarquee}
                onDoubleClick={() => openModal('editThreadTitle', { thread })}
              />
            </div>
            {generating && <RefreshCw className="w-4 h-4 text-primary animate-spin shrink-0" />}
            {queuedCount > 1 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white bg-primary rounded-full shrink-0">
                {queuedCount}
              </span>
            )}
          </div>
        </div>

        <div className="px-4 md:px-8 py-4 space-y-4">
          {messages.length === 0 && !generating ? (
            <p className="text-secondary text-sm text-center py-8">{t('placeholder')}</p>
          ) : (
            <>
              {visibleStartIndex > 0 && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleLoadEarlier}
                    className="min-h-[44px] px-4 py-2 text-sm text-secondary hover:text-text border border-border-light rounded-lg hover:border-border transition-colors"
                  >
                    {t('loadEarlierMessages', {
                      count: Math.min(visibleStartIndex, messageThreshold || 50),
                    })}
                  </button>
                </div>
              )}
              {messages.map((msg, idx) => {
                if (msg.isSummaryMarker) {
                  const isVisible = idx >= visibleStartIndex
                  let nextIdx = idx + 1
                  while (nextIdx < messages.length && messages[nextIdx].isSummaryMarker) nextIdx++
                  const nextVisible = nextIdx < messages.length && nextIdx >= visibleStartIndex
                  if (!isVisible || !nextVisible) return null
                  return (
                    <div key={msg.id} className="flex items-center gap-3 my-2 px-1">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-tertiary uppercase tracking-wider whitespace-nowrap">
                        {t('summarizationMarker')}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )
                }

                if (msg.isAutoTitleMarker) {
                  const isVisible = idx >= visibleStartIndex
                  let nextIdx = idx + 1
                  while (
                    nextIdx < messages.length &&
                    (messages[nextIdx].isAutoTitleMarker || messages[nextIdx].isSummaryMarker)
                  )
                    nextIdx++
                  const nextVisible = nextIdx < messages.length && nextIdx >= visibleStartIndex
                  if (!isVisible || !nextVisible) return null
                  return (
                    <div key={msg.id} className="flex items-center gap-3 my-2 px-1">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-tertiary uppercase tracking-wider whitespace-nowrap">
                        {t('autoTitleMarker')}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )
                }

                if (idx < visibleStartIndex) return null

                const entries = parseBundleEntries(msg.bundleMessages)
                const bundleMessages = entries ? entries.map((e) => e.content) : null
                const trackIdx = activeSlotIndices[msg.id]
                const bundleIndex =
                  trackIdx !== undefined && bundleMessages
                    ? Math.min(trackIdx, bundleMessages.length - 1)
                    : bundleMessages && msg.content
                      ? Math.max(0, bundleMessages.indexOf(msg.content))
                      : 0
                const currentOrigin =
                  entries && bundleIndex >= 0 && bundleIndex < entries.length
                    ? entries[bundleIndex].origin || null
                    : null
                const slotCreatedAt = entries?.[bundleIndex]?.createdAt || msg.createdAt
                const bundleEntry = entries?.[bundleIndex]
                const isFailedSlot = bundleEntry?.isError === true
                const errorText = isFailedSlot
                  ? bundleEntry.error || bundleEntry.content || ''
                  : null
                return (
                  <div
                    key={msg.id}
                    data-message-id={msg.id}
                    data-unread={msg.isUnread ? 'true' : 'false'}
                  >
                    <MessageBubble
                      message={msg}
                      messageNumber={idx + 1}
                      avatarSrc={getAvatarSrc(msg)}
                      avatarScale={getAvatarScale(msg)}
                      role={msg.role}
                      personaMap={personaMap}
                      nameLabel={getMessageName(msg)}
                      streaming={msg.id === streamingMsgId}
                      bundleMessages={bundleMessages}
                      bundleIndex={bundleIndex}
                      currentOrigin={currentOrigin}
                      slotCreatedAt={slotCreatedAt}
                      onBundleNavigate={handleBundleNavigate}
                      onDeleteRequest={(id) => setConfirmDeleteId(id)}
                      onEdit={handleEditMessage}
                      onFork={handleForkMessage}
                      onRegenerate={handleRegenerate}
                      onSpeak={() => {}}
                      generating={generating}
                      requestFailed={isFailedSlot}
                      errorText={errorText}
                      isUnread={msg.isUnread || false}
                      charName={character?.name || ''}
                      personaName={personaMap[thread?.personaId]?.name || ''}
                    />
                  </div>
                )
              })}
            </>
          )}
          <div ref={messagesEndRef} />

          {showScrollButton && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="sticky bottom-4 left-1/2 -translate-x-1/2 size-[44px] flex items-center justify-center bg-primary text-on-primary rounded-full shadow-surface-lg hover:bg-primary-hover transition-all duration-200"
              aria-label={t('scrollToBottom')}
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-border bg-surface">
        {' '}
        {/* Wrap input for better control */}
        <ChatInputArea
          threadId={threadId}
          onSend={handleSend}
          onCancel={handleCancel}
          generating={generating}
          summarizing={summarizing}
          hasQueued={queuedCount > 0}
        />
      </div>

      {confirmDeleteId && (
        <ConfirmDialog
          title={t('messageDeleteTitle')}
          message={t('messageDeleteConfirm', { number: deletedMsgNumber })}
          confirmLabel={t('deleteThread')}
          cancelLabel={t('cancel')}
          variant="danger"
          onConfirm={() => handleDeleteMessage(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}

export default ChatView
