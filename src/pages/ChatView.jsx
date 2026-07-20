import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, RefreshCw, Clock, Square } from '../lib/icons'
import { useModal } from '../hooks/useModal'
import { useHordeEta } from '../hooks/useHordeEta'
import { showToast } from '../lib/toast'
import { useConfirm } from '../lib/confirm'
import Avatar from '../components/shared/Avatar'
import MarkdownTitle from '../components/shared/MarkdownTitle'
import MarqueeText from '../components/shared/MarqueeText'
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
  deleteMessagesFrom,
  trimLeadingTrailingNewlines,
  trimWhitespace,
} from '../services/messages'
import {
  getEffectiveProfileFor,
  getEffectiveTopP,
  getProfile,
} from '../services/connectionProfiles'
import { getSetting } from '../services/settings'
import { generateChatResponse, parseBundleEntries } from '../services/chatGeneration'
import { isMessageHidden } from '../services/chatApi'
import * as apiQueue from '../services/apiQueue'
import {
  getGeneratingThreads,
  markFirstMessageTriggered,
  hasFirstMessageTriggered,
  getStreamingMessageId,
  setStreamingMessageId,
  clearStreamingMessageId,
  setStreamingSlotIndex,
  getStreamingSlotIndex,
  clearStreamingSlotIndex,
  setStreamingStartTime,
  clearStreamingStartTime,
} from '../services/generatingState'
import { shouldAutoTitle, triggerAutoTitle } from '../services/autoTitle'
import {
  detectOrphanedMessages,
  cleanupSendOrphan,
  cleanupRegenerateOrphan,
} from '../services/recovery'
import {
  shouldTriggerSummarization,
  triggerSummarization,
  getUnsummarizedMessages,
  cancelPendingSummarizationAndClearMarker,
  registerPendingMarker,
  clearPendingMarker,
} from '../services/summarization'
import { setBaseTitle } from '../services/titleManager'
import { estimateTokens } from '../services/tokenEstimator'
import {
  isAwayFromThread,
  addUnread,
  clearUnread,
  markMessageRead,
  playNotificationSound,
} from '../services/unread'
import db from '../db'

function rebuildFailedState(msgs) {
  const slots = {}
  for (const msg of msgs || []) {
    const entries = parseBundleEntries(msg.bundleMessages)
    if (!entries) continue
    if (msg.activeSlotIndex != null && msg.activeSlotIndex < entries.length) {
      slots[msg.id] = msg.activeSlotIndex
    } else {
      let idx = 0
      if (msg.content) {
        const found = entries.findIndex((e) => e.content === msg.content)
        if (found !== -1) idx = found
      }
      slots[msg.id] = idx
    }
  }
  return { slots }
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

function ScenarioStatusBar({ scenario, charName, userName }) {
  const { t } = useTranslation('chat')
  const display = (() => {
    const raw =
      scenario.name?.trim() ||
      `${t('scenarioLabel', { ns: 'characterCreation' })} #${scenario.scenarioNumber ?? ''}`
    return raw.replace(/\{\{char\}\}/gi, charName).replace(/\{\{user\}\}/gi, userName)
  })()

  return (
    <div className="sticky top-[49px] z-10 bg-surface border-b border-border-light px-4 md:px-8 py-1 text-center">
      <MarqueeText className="text-xs text-tertiary" marquee>
        {display}
      </MarqueeText>
    </div>
  )
}

function ChatView() {
  const { threadId } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation('chat')
  const { openModal } = useModal()
  const messagesEndRef = useRef(null)
  const scrollRef = useRef(null)
  const generatingRef = useRef(false)
  const isAtBottomRef = useRef(true)
  const autoTriggeredRef = useRef(false)
  const isLocalStreamerRef = useRef(false)
  const currentThreadIdRef = useRef(threadId)
  const handleSendRef = useRef(null)
  const scrollCommits = useRef(0)
  const scrollStickyCleanupRef = useRef(null)
  const prevMessagesLengthRef = useRef(0)
  const prevScrollHeightRef = useRef(0)
  const messagesGrewRef = useRef(false)
  const loadEarlierSuppressUntilRef = useRef(0)
  const scrollClearedRef = useRef(false)
  const generatingFetchIdRef = useRef(0)
  const streamingMsgIdRef = useRef(null)
  const messagesRef = useRef(null)
  const failedIdsRef = useRef(new Set())
  const [thread, setThread] = useState(null)
  const [character, setCharacter] = useState(null)
  const [personaMap, setPersonaMap] = useState({})
  const [selectedPersonaId, setSelectedPersonaId] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [queuedCount, setQueuedCount] = useState(0)
  const [blockingGenerating, setBlockingGenerating] = useState(false)
  const [blockingQueued, setBlockingQueued] = useState(false)
  const [autoTitling, setAutoTitling] = useState(false)
  const [pendingMarkers, setPendingMarkers] = useState([])
  const [streamingMsgId, setStreamingMsgId] = useState(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [noChatProfile, setNoChatProfile] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [charAvatarScale, setCharAvatarScale] = useState('1x')
  const [personaAvatarScale, setPersonaAvatarScale] = useState('1x')
  const [visibleStartIndex, setVisibleStartIndex] = useState(0)
  const [messageThreshold, setMessageThreshold] = useState(0)
  const [activeSlotIndices, setActiveSlotIndices] = useState({})
  const [streamingSlotIndices, setStreamingSlotIndices] = useState({})
  const [isTabVisible, setIsTabVisible] = useState(true)
  const [systemAvatar, setSystemAvatar] = useState('')
  const [oocMessageRole, setOocMessageRole] = useState('system')
  const [chatTitleMarquee, setChatTitleMarquee] = useState(true)
  const [chatModelName, setChatModelName] = useState('')
  const [chatModelTemp, setChatModelTemp] = useState(null)
  const [chatModelTopP, setChatModelTopP] = useState(null)
  const [chatProfile, setChatProfile] = useState(null)
  const [showStatus, setShowStatus] = useState(true)
  const [statusBarRefresh, setStatusBarRefresh] = useState(30)
  const [oocActive, setOocActive] = useState(false)
  const [pendingRecovery, setPendingRecovery] = useState(null)
  const [memoryDefaults, setMemoryDefaults] = useState({
    mode: 'messages',
    messagesThreshold: 7,
    contextWindowThreshold: 1024,
  })
  const scrollHeightBeforeRef = useRef(null)
  const hordeEta = useHordeEta(showStatus, oocActive ? 'ooc' : 'chat', statusBarRefresh)

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
      setMessages(dedupeMessages(msgs))

      const { slots } = rebuildFailedState(msgs)
      setActiveSlotIndices(slots)
      setStreamingSlotIndices({})

      const streamingMsgId = getStreamingMessageId(threadId)
      if (streamingMsgId != null) {
        const savedSlot = getStreamingSlotIndex(threadId)
        if (savedSlot != null) {
          setStreamingSlotIndices({ [streamingMsgId]: savedSlot })
        }
      }

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

      const [defMemory, defMsgThreshold, defCtxThreshold] = await Promise.all([
        getSetting('defaultMemory'),
        getSetting('defaultMessagesThreshold'),
        getSetting('defaultContextWindowThreshold'),
      ])
      setMemoryDefaults({
        mode: defMemory ?? 'messages',
        messagesThreshold: Number(defMsgThreshold) || 7,
        contextWindowThreshold: Number(defCtxThreshold) || 1024,
      })

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

      const orphan = detectOrphanedMessages(msgs)
      if (orphan && !generatingRef.current && !getGeneratingThreads().has(Number(threadId))) {
        if (orphan.type === 'send') {
          await cleanupSendOrphan(orphan.messageId)
        } else if (orphan.type === 'regenerate') {
          await cleanupRegenerateOrphan(orphan.messageId, msgs)
        }
        const updatedMsgs = await getMessagesByThread(threadId)
        setMessages(dedupeMessages(updatedMsgs))
        setPendingRecovery(orphan)
      }
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
    Promise.resolve().then(() => {
      setShowScrollButton(false)
      setGenerating(false)
      setStreamingMsgId(null)
      setActiveSlotIndices({})
      setPendingRecovery(null)
      loadData()
    })
  }, [threadId])

  useEffect(() => {
    if (!pendingRecovery || generatingRef.current) return
    const orphan = pendingRecovery
    setPendingRecovery(null)
    showToast(t('retryingInterrupted', { ns: 'chat' }), { type: 'info' })
    if (orphan.type === 'send') {
      handleSend(null, null, orphan.isOOC, true)
    } else if (orphan.type === 'regenerate') {
      handleRegenerate(orphan.messageId, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRecovery])

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
    const newlyAdded = grew ? messages.slice(prevMessagesLengthRef.current) : []
    const onlyMarkers =
      grew &&
      newlyAdded.length > 0 &&
      newlyAdded.every((m) => m.isSummaryMarker || m.isAutoTitleMarker)
    const messagesGrew = grew && !onlyMarkers
    messagesGrewRef.current = messagesGrew
    prevMessagesLengthRef.current = messages.length

    if (!messagesGrew && scrollCommits.current > 0) {
      const el = scrollRef.current
      if (el) {
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 100
        isAtBottomRef.current = atBottom
        setShowScrollButton(!atBottom)
      }
      return
    }

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
    return () => {
      scrollStickyCleanupRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (messages.length === 0) {
      setShowScrollButton(false)
      isAtBottomRef.current = true
      return
    }
    const el = scrollRef.current
    if (!el || scrollCommits.current <= 1) return

    if (messagesGrewRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else if (
      isAtBottomRef.current &&
      !scrollClearedRef.current &&
      el.scrollHeight !== prevScrollHeightRef.current
    ) {
      el.scrollTo({ top: el.scrollHeight })
      setShowScrollButton(false)
    } else {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 100
      isAtBottomRef.current = atBottom
      setShowScrollButton(!atBottom)
    }
    prevScrollHeightRef.current = el.scrollHeight
    scrollClearedRef.current = false
  }, [messages])

  useEffect(() => {
    setVisibleStartIndex((prev) => {
      let next = Math.min(prev, messages.length)
      if (messageThreshold > 0 && isAtBottomRef.current) {
        next = Math.max(next, messages.length - messageThreshold)
      }
      return next
    })
  }, [messages, messageThreshold])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    async function loadChatModel() {
      const kind = oocActive ? 'ooc' : 'chat'
      const profile = await getEffectiveProfileFor(kind)
      setChatModelName(profile?.model || '')
      const temp = profile?.params?.temperature
      setChatModelTemp(typeof temp === 'number' ? temp : null)
      setChatModelTopP(getEffectiveTopP(profile))
      const profileId = await getSetting(`requestKind.${kind}.profileId`)
      setChatProfile(profileId ? await getProfile(profileId) : null)
    }
    loadChatModel()
    function onSettingsChanged(e) {
      const key = e.detail?.key
      if (key === 'requestKind.chat.profileId' || key === 'requestKind.ooc.profileId') {
        loadChatModel()
      }
    }
    function onProfileChanged() {
      loadChatModel()
    }
    window.addEventListener('settings-changed', onSettingsChanged)
    window.addEventListener('connectionProfiles-changed', onProfileChanged)
    return () => {
      window.removeEventListener('settings-changed', onSettingsChanged)
      window.removeEventListener('connectionProfiles-changed', onProfileChanged)
    }
  }, [oocActive])

  useEffect(() => {
    async function loadShowStatus() {
      const val = await getSetting('showStatus')
      setShowStatus(val !== false)
    }
    loadShowStatus()
    function onSettingsChanged(e) {
      if (e.detail?.key === 'showStatus') {
        setShowStatus(e.detail.value !== false)
      }
    }
    window.addEventListener('settings-changed', onSettingsChanged)
    return () => window.removeEventListener('settings-changed', onSettingsChanged)
  }, [])

  useEffect(() => {
    async function loadStatusBarRefresh() {
      const val = await getSetting('statusBarRefresh')
      if (typeof val === 'number') setStatusBarRefresh(val)
    }
    loadStatusBarRefresh()
    function onSettingsChanged(e) {
      if (e.detail?.key === 'statusBarRefresh') {
        const val = Number(e.detail.value)
        if (typeof val === 'number' && !isNaN(val)) setStatusBarRefresh(val)
      }
    }
    window.addEventListener('settings-changed', onSettingsChanged)
    return () => window.removeEventListener('settings-changed', onSettingsChanged)
  }, [])

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
    function handleDirectorDetailsUpdated(e) {
      if (Number(e.detail?.threadId) !== Number(threadId)) return
      getMessagesByThread(threadId).then((msgs) => setMessages(dedupeMessages(msgs)))
    }
    window.addEventListener('director-details-updated', handleDirectorDetailsUpdated)
    return () =>
      window.removeEventListener('director-details-updated', handleDirectorDetailsUpdated)
  }, [threadId])

  useEffect(() => {
    streamingMsgIdRef.current = streamingMsgId
  }, [streamingMsgId])

  useEffect(() => {
    function handleMessagesChanged(e) {
      if (Number(e.detail?.threadId) !== Number(threadId)) return
      getMessagesByThread(threadId).then((msgs) => {
        const fresh = dedupeMessages(msgs)
        if (!generatingRef.current) {
          setMessages(fresh)
          return
        }
        setMessages((prev) => {
          const prevMap = new Map(prev.map((m) => [m.id, m]))
          return fresh.map((m) => {
            const prevMsg = prevMap.get(m.id)
            if (!prevMsg) return m
            if (prevMsg.id === streamingMsgIdRef.current) {
              return { ...m, content: prevMsg.content }
            }
            return m
          })
        })
      })
    }
    window.addEventListener('messages-changed', handleMessagesChanged)
    return () => window.removeEventListener('messages-changed', handleMessagesChanged)
  }, [threadId])

  useEffect(() => {
    if (loading || !character || noChatProfile) return
    if (
      !autoTriggeredRef.current &&
      !hasFirstMessageTriggered(threadId) &&
      messages.length === 0 &&
      !thread?.initialMessages?.length &&
      character.firstMessage
    ) {
      autoTriggeredRef.current = true
      markFirstMessageTriggered(threadId)
      handleSendRef.current?.('', null, false)
    }
  }, [loading, character, noChatProfile, thread?.initialMessages, threadId, messages.length])

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
      const state = apiQueue.getState()
      const tid = Number(threadId)
      setQueuedCount(state.queue.filter((q) => q.threadId === tid).length)
      setBlockingQueued(
        state.queue.some((q) => q.threadId === tid && apiQueue.BLOCKING_KINDS.includes(q.type)),
      )
      setBlockingGenerating(
        state.inflight.some((i) => i.threadId === tid && apiQueue.BLOCKING_KINDS.includes(i.type)),
      )
    }
    handler()
    const unsub = apiQueue.subscribe(handler)
    window.addEventListener('api-queue-changed', handler)
    return () => {
      unsub()
      window.removeEventListener('api-queue-changed', handler)
    }
  }, [threadId])

  useEffect(() => {
    if (getGeneratingThreads().has(Number(threadId))) {
      Promise.resolve().then(() => setGenerating(true))
    }
    function handleGeneratingChange(e) {
      const { threadId: eventThreadId, generating: isGenerating } = e.detail
      if (Number(eventThreadId) === Number(threadId)) {
        setGenerating(isGenerating)
        if (!isGenerating) {
          const fetchId = ++generatingFetchIdRef.current
          getMessagesByThread(threadId).then((msgs) => {
            if (
              fetchId === generatingFetchIdRef.current &&
              Number(currentThreadIdRef.current) === Number(threadId)
            ) {
              setMessages(dedupeMessages(msgs))
              const { slots } = rebuildFailedState(msgs)
              setActiveSlotIndices(slots)
            }
          })
        }
      }
    }
    window.addEventListener('generating-state-changed', handleGeneratingChange)
    return () => window.removeEventListener('generating-state-changed', handleGeneratingChange)
  }, [threadId])

  async function derivePendingMarkers(state, tid) {
    const pending = []
    const [atMarker, summMarker] = await Promise.all([
      getSetting('autoTitleMarker'),
      getSetting('summarizationMarker'),
    ])
    if (atMarker) {
      if (state.inflight.some((i) => i.threadId === tid && i.type === 'autoTitle')) {
        pending.push({ type: 'autoTitle', status: 'active' })
      } else if (state.queue.some((q) => q.threadId === tid && q.type === 'autoTitle')) {
        pending.push({ type: 'autoTitle', status: 'queued' })
      }
    }
    if (summMarker) {
      if (state.inflight.some((i) => i.threadId === tid && i.type === 'summarization')) {
        pending.push({ type: 'summarization', status: 'active' })
      } else if (state.queue.some((q) => q.threadId === tid && q.type === 'summarization')) {
        pending.push({ type: 'summarization', status: 'queued' })
      }
    }
    return pending
  }

  useEffect(() => {
    let cancelled = false
    async function reconstruct() {
      const state = apiQueue.getState()
      const tid = Number(threadId)
      const pending = await derivePendingMarkers(state, tid)
      if (cancelled) return
      setPendingMarkers(pending)
    }
    reconstruct()
    return () => {
      cancelled = true
    }
  }, [threadId])

  useEffect(() => {
    function handleQueueChange() {
      const state = apiQueue.getState()
      const tid = Number(threadId)
      derivePendingMarkers(state, tid).then((pending) => setPendingMarkers(pending))
    }
    window.addEventListener('api-queue-changed', handleQueueChange)
    return () => window.removeEventListener('api-queue-changed', handleQueueChange)
  }, [threadId])

  useEffect(() => {
    let cancelled = false
    const msgId = getStreamingMessageId(threadId)
    if (msgId != null) {
      Promise.resolve().then(() => {
        if (!cancelled) setStreamingMsgId(msgId)
      })
    }
    function handleStreamingChange(e) {
      const { threadId: eventThreadId, messageId } = e.detail
      if (Number(eventThreadId) === Number(threadId)) {
        setStreamingMsgId(messageId)
      }
    }
    window.addEventListener('streaming-message-changed', handleStreamingChange)
    return () => {
      cancelled = true
      window.removeEventListener('streaming-message-changed', handleStreamingChange)
    }
  }, [threadId])

  useEffect(() => {
    if (!generating) return
    let cancelled = false
    const poll = async () => {
      if (cancelled || isLocalStreamerRef.current) return
      const msgs = await getMessagesByThread(threadId)
      if (cancelled || isLocalStreamerRef.current) return
      if (Number(currentThreadIdRef.current) === Number(threadId)) {
        setMessages(dedupeMessages(msgs))
      }
    }
    poll()
    const interval = setInterval(poll, 400)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [generating, threadId])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 100
    setShowScrollButton(!atBottom)
    isAtBottomRef.current = atBottom
    if (atBottom) {
      clearUnread(threadId)
      scrollClearedRef.current = true
      setMessages((prev) => prev.map((m) => ({ ...m, isUnread: false })))
      if (messageThreshold > 0 && Date.now() > loadEarlierSuppressUntilRef.current) {
        setVisibleStartIndex((prev) =>
          Math.max(prev, messagesRef.current.length - messageThreshold),
        )
      }
    }
  }, [threadId, messageThreshold])

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
    loadEarlierSuppressUntilRef.current = Date.now() + 800
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
      const activeIdx = msg.activeSlotIndex ?? activeSlotIndices[msg.id] ?? 0
      if (activeIdx < 0 || activeIdx >= entries.length) continue
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
    apiQueue.cancelThreadRequests(threadId, { kinds: apiQueue.BLOCKING_KINDS })
  }

  function handleCancelAutoTitle() {
    openModal('autoTitleCancel', { threadId })
  }

  function handleCancelSummarization() {
    openModal('summaryCancel', { threadId })
  }

  function withoutFailedMessages(msgs) {
    const ids = failedIdsRef.current
    return ids.size > 0 ? msgs.filter((m) => !ids.has(m.id)) : msgs
  }

  function isRealMessage(m) {
    return !m?.isSummaryMarker && !m?.isAutoTitleMarker
  }

  // Defensive: collapse any duplicate ids in a DB-fetched message list so a stale
  // race between a full-replace setMessages and an optimistic append can never
  // render two bubbles for the same message.
  function dedupeMessages(msgs) {
    const seen = new Map()
    for (const m of msgs) seen.set(m.id, m)
    return Array.from(seen.values())
  }

  // Trailing-edge throttle: buffers rapid onToken calls and fires at most once per interval.
  // The caller writes the final content explicitly after generateChatResponse returns, so no
  // flush-on-completion is needed.
  function createTrailingThrottle(fn, intervalMs) {
    let timer = null
    let lastArgs = null
    function throttled(...args) {
      lastArgs = args
      if (!timer) {
        timer = setTimeout(() => {
          timer = null
          fn(...lastArgs)
        }, intervalMs)
      }
    }
    throttled.cancel = () => {
      clearTimeout(timer)
      timer = null
    }
    return throttled
  }

  async function doChatRequest(
    isFirstMessage,
    currentMsgs,
    chatPersona,
    currentPersona,
    isOOC = false,
    signal,
    ctx,
  ) {
    currentMsgs = withoutFailedMessages(currentMsgs)

    const assistantMsgId = await createAssistantMessage(
      threadId,
      '',
      null,
      isOOC,
      isOOC && character?.includeOOC === false,
    )
    setStreamingMessageId(threadId, assistantMsgId)
    setStreamingStartTime(assistantMsgId, Date.now())
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
          bundleMessages: JSON.stringify([
            { content: '', hidden: isOOC && character?.includeOOC === false },
          ]),
          createdAt: new Date(),
        },
      ])
    }

    // Throttle intermediate streaming writes to avoid firing updateMessage on every token.
    const streamIntoBubble = (fullContent) => {
      updateMessage(assistantMsgId, { content: fullContent })
      if (Number(currentThreadIdRef.current) === Number(threadId)) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullContent } : m)),
        )
      }
    }
    const throttledToken = createTrailingThrottle(streamIntoBubble, 100)

    let outcome = 'failed'
    try {
      const result = await generateChatResponse({
        character,
        chatPersona,
        currentPersona,
        currentMsgs,
        isFirstMessage,
        isOOC,
        threadId,
        personaMap,
        signal,
        onToken: throttledToken,
        onFinish: (reason) => {
          if (reason === 'length' && Number(currentThreadIdRef.current) === Number(threadId)) {
            showToast(t('responseTruncated', { ns: 'chat' }), { type: 'warning' })
          }
        },
        ctx,
      })

      throttledToken.cancel()

      if (result.status === 'no-profile') {
        await deleteMessage(assistantMsgId)
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId))
        }
        return { outcome: 'failed', messageId: assistantMsgId }
      }

      if (result.status === 'empty') {
        const failedEntry = {
          content: '',
          promptData: null,
          isError: true,
          error: null,
          createdAt: new Date().toISOString(),
          hidden: isOOC && character?.includeOOC === false,
        }
        await updateMessage(assistantMsgId, {
          content: '',
          bundleMessages: JSON.stringify([failedEntry]),
        })
        const newFailed = new Set(failedIdsRef.current)
        newFailed.add(assistantMsgId)
        failedIdsRef.current = newFailed
      }

      if (result.status === 'error') {
        const failedEntry = {
          content: result.error || '',
          promptData: null,
          isError: true,
          error: result.error || null,
          createdAt: new Date().toISOString(),
          hidden: isOOC && character?.includeOOC === false,
        }
        await updateMessage(assistantMsgId, {
          content: result.error || '',
          bundleMessages: JSON.stringify([failedEntry]),
        })
        const msgs = await getMessagesByThread(threadId)
        if (Number(currentThreadIdRef.current) === Number(threadId))
          setMessages(dedupeMessages(msgs))
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          showToast(result.error, { type: 'error' })
        }
        const newFailed = new Set(failedIdsRef.current)
        newFailed.add(assistantMsgId)
        failedIdsRef.current = newFailed
      }

      if (result.status === 'success') {
        const successEntry = {
          content: result.content,
          promptData: result.promptData || null,
          responseData: result.responseData || null,
          apiDurationMs: result.apiDurationMs ?? null,
          createdAt: new Date().toISOString(),
          hidden: isOOC && character?.includeOOC === false,
        }
        const successBundleJson = JSON.stringify([successEntry])
        await updateMessage(assistantMsgId, {
          content: result.content,
          promptData: result.promptData,
          responseData: result.responseData,
          apiDurationMs: result.apiDurationMs,
          bundleMessages: successBundleJson,
        })
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: result.content,
                    apiDurationMs: result.apiDurationMs,
                    bundleMessages: successBundleJson,
                  }
                : m,
            ),
          )
        }
        outcome = 'succeeded'
      }
    } catch (err) {
      throttledToken.cancel()
      if (err.name === 'AbortError') {
        const dbMsg = await db.messages.get(Number(assistantMsgId))
        const partial = dbMsg?.content || ''
        const keptEntry = {
          content: partial,
          promptData: null,
          responseData: null,
          apiDurationMs: null,
          createdAt: dbMsg?.createdAt || new Date().toISOString(),
          hidden: isOOC && character?.includeOOC === false,
        }
        await updateMessage(assistantMsgId, {
          content: partial,
          bundleMessages: JSON.stringify([keptEntry]),
          activeSlotIndex: 0,
        })
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: partial,
                    bundleMessages: JSON.stringify([keptEntry]),
                    activeSlotIndex: 0,
                  }
                : m,
            ),
          )
        }
        throw err
      }
      // Non-abort errors that escape generateChatResponse are unexpected; treat as fatal
      const failedEntry = {
        content: err.message || '',
        promptData: null,
        isError: true,
        error: err.message || null,
        createdAt: new Date().toISOString(),
        hidden: isOOC && character?.includeOOC === false,
      }
      await updateMessage(assistantMsgId, {
        content: err.message || '',
        bundleMessages: JSON.stringify([failedEntry]),
      })
      const msgs = await getMessagesByThread(threadId)
      if (Number(currentThreadIdRef.current) === Number(threadId)) setMessages(dedupeMessages(msgs))
      if (Number(currentThreadIdRef.current) === Number(threadId)) {
        showToast(err.message, { type: 'error' })
      }
      const newFailed = new Set(failedIdsRef.current)
      newFailed.add(assistantMsgId)
      failedIdsRef.current = newFailed
    } finally {
      clearStreamingStartTime(assistantMsgId)
      clearStreamingMessageId(threadId)
      if (Number(currentThreadIdRef.current) === Number(threadId)) {
        setStreamingMsgId(null)
      }
    }
    return { outcome, messageId: assistantMsgId }
  }

  async function runPostGenerationTasks({
    threadId,
    outcome,
    notifyMessageId,
    includeSummarization,
    currentPersona,
  }) {
    if (outcome === 'aborted') return

    try {
      const away = isAwayFromThread(threadId) || !isAtBottomRef.current
      if (away) {
        await addUnread(threadId, notifyMessageId)
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          setMessages((prev) =>
            prev.map((m) => (m.id === notifyMessageId ? { ...m, isUnread: true } : m)),
          )
        }
        const soundEnabled = await getSetting('unreadSound')
        if (soundEnabled) playNotificationSound()
      }
    } catch {
      // Non-critical: unread tracking failure shouldn't block the response
    }

    if (outcome !== 'succeeded') return

    try {
      const msgs = await getMessagesByThread(threadId)
      const nonFailedMsgs = withoutFailedMessages(msgs)
      const thr = await getThread(threadId)
      const chr = await getCharacter(thr.characterId)

      if (await shouldAutoTitle(thr, chr, nonFailedMsgs)) {
        showToast(t('autoTitleGenerating'), { type: 'info' })
        const atAbort = new AbortController()
        const showMarker = await getSetting('autoTitleMarker')
        const triggerLastCreatedAt =
          nonFailedMsgs.length > 0 ? nonFailedMsgs[nonFailedMsgs.length - 1].createdAt : null
        setAutoTitling(true)
        let markerId = null
        try {
          if (showMarker && triggerLastCreatedAt != null) {
            markerId = await createAutoTitleMarker(threadId, triggerLastCreatedAt)
            const updated = await getMessagesByThread(threadId)
            if (Number(currentThreadIdRef.current) === Number(threadId)) {
              setMessages(dedupeMessages(updated))
            }
          }
          await apiQueue.enqueue({
            threadId,
            type: 'autoTitle',
            signal: atAbort.signal,
            controller: atAbort,
            execute: async (ctx) => {
              return await triggerAutoTitle({
                thread: thr,
                character: chr,
                messages: nonFailedMsgs,
                personaMap,
                currentPersona,
                signal: atAbort.signal,
                ctx,
              })
            },
          }).promise
          const updatedThr = await getThread(threadId)
          setThread((prev) => ({ ...prev, title: updatedThr.title, autoTitleGenerated: true }))
          showToast(t('autoTitleGenerated'), { type: 'success' })
        } catch (err) {
          if (err.name !== 'AbortError') {
            showToast(err.message, { type: 'error' })
          }
          if (markerId != null) {
            await deleteMessage(markerId)
            const updated = await getMessagesByThread(threadId)
            if (Number(currentThreadIdRef.current) === Number(threadId)) {
              setMessages(dedupeMessages(updated))
            }
          }
        } finally {
          setAutoTitling(false)
          if (showMarker) {
            setPendingMarkers((prev) => prev.filter((m) => m.type !== 'autoTitle'))
          }
        }
      }

      if (
        includeSummarization &&
        chr &&
        (await shouldTriggerSummarization({
          character: chr,
          messages: nonFailedMsgs,
          includeOOC: chr.includeOOC !== false,
        }))
      ) {
        const currentThread = await getThread(threadId)
        const unsummarizedMessages = getUnsummarizedMessages(nonFailedMsgs, {
          includeOOC: chr.includeOOC !== false,
        })
        if (unsummarizedMessages.length > 0) {
          const summAbort = new AbortController()
          const showMarker = await getSetting('summarizationMarker')
          showToast('Generating summary', { type: 'info' })

          const cancelledMarkerId = await cancelPendingSummarizationAndClearMarker(threadId)
          if (cancelledMarkerId) {
            const updated = await getMessagesByThread(threadId)
            if (Number(currentThreadIdRef.current) === Number(threadId)) {
              setMessages(dedupeMessages(updated))
            }
          }

          let summaryMarkerId = null
          try {
            if (showMarker && unsummarizedMessages.length > 0) {
              const anchorCreatedAt =
                unsummarizedMessages[unsummarizedMessages.length - 1].createdAt
              summaryMarkerId = await createSummaryMarker(threadId, anchorCreatedAt)
              registerPendingMarker(threadId, summaryMarkerId)
              const updated = await getMessagesByThread(threadId)
              if (Number(currentThreadIdRef.current) === Number(threadId)) {
                setMessages(dedupeMessages(updated))
              }
            }
            const summary = await apiQueue.enqueue({
              threadId,
              type: 'summarization',
              signal: summAbort.signal,
              controller: summAbort,
              execute: async (ctx) => {
                return await triggerSummarization({
                  thread: currentThread,
                  character: chr,
                  messages: nonFailedMsgs,
                  personaMap,
                  signal: summAbort.signal,
                  currentPersona: null,
                  ctx,
                })
              },
            }).promise
            if (summary) {
              setThread((prev) => (prev ? { ...prev, memory: summary } : prev))
              showToast('Summary generated', { type: 'success' })
            }
          } catch (err) {
            if (err.name !== 'AbortError') {
              showToast(err.message || 'Summarization failed', { type: 'error' })
            }
            if (summaryMarkerId != null) {
              await deleteMessage(summaryMarkerId)
              const updated = await getMessagesByThread(threadId)
              if (Number(currentThreadIdRef.current) === Number(threadId)) {
                setMessages(dedupeMessages(updated))
              }
            }
          } finally {
            clearPendingMarker(threadId)
            if (showMarker) {
              setPendingMarkers((prev) => prev.filter((m) => m.type !== 'summarization'))
            }
          }
        }
      }
    } catch {
      // Non-critical: post-generation tasks (auto-title, summarize) shouldn't block the flow
    }
  }

  async function handleSend(text, personaId, isOOC, autoReply = true) {
    if (generatingRef.current) return
    generatingRef.current = true
    isLocalStreamerRef.current = true

    let sendOutcome = 'aborted'
    let sendMessageId = null
    let currentPersona = null

    try {
      let currentMsgs = messages
      let chatPersona = null

      if (thread?.personaId) {
        chatPersona = await getPersona(thread.personaId)
      }

      if (text) {
        const trimMsgs = await getSetting('prompting.trimMessages')
        let userText = trimMsgs ? trimLeadingTrailingNewlines(text) : text
        const trimWs = await getSetting('prompting.trimWhitespaces')
        if (trimWs) userText = trimWhitespace(userText)
        await createMessage(
          threadId,
          'user',
          userText,
          personaId,
          isOOC,
          isOOC && character?.includeOOC === false,
        )
        currentMsgs = await getMessagesByThread(threadId)
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          setMessages(dedupeMessages(currentMsgs))
        }

        const thr = await getThread(threadId)
        if (thr?.lastSummarizationAt) {
          const chr = thr?.characterId ? await getCharacter(thr.characterId) : null
          const rollover =
            chr?.messageRollover ?? (await getSetting('defaultMessageRollover')) ?? 'rollover'
          if (rollover === 'rollover') {
            const kept = Number(
              chr?.messagesToKeep ?? (await getSetting('defaultMessagesToKeep')) ?? 0,
            )
            if (kept > 0) {
              await updateThread(threadId, {
                keptConsumedCount: (Number(thr.keptConsumedCount) || 0) + 1,
              })
            }
          }
        }
      }

      const isFirstMessage =
        currentMsgs.filter((m) => isRealMessage(m) && !isMessageHidden(m)).length === 0

      if (text && !autoReply) return

      currentPersona = personaId ? await getPersona(personaId) : chatPersona
      const abortController = new AbortController()

      const { outcome, messageId } = await apiQueue.enqueue({
        threadId,
        type: 'chat',
        signal: abortController.signal,
        controller: abortController,
        execute: async (ctx) => {
          return await doChatRequest(
            isFirstMessage,
            currentMsgs,
            chatPersona,
            currentPersona,
            isOOC,
            abortController.signal,
            ctx,
          )
        },
      }).promise

      sendOutcome = outcome
      sendMessageId = messageId
    } catch {
      // doChatRequest re-throws AbortError on cancel — handled silently
    } finally {
      generatingRef.current = false
      isLocalStreamerRef.current = false
      if (Number(currentThreadIdRef.current) === Number(threadId)) {
        setGenerating(false)
      }
      await runPostGenerationTasks({
        threadId,
        outcome: sendOutcome,
        notifyMessageId: sendMessageId,
        includeSummarization: true,
        currentPersona,
      })
    }
  }

  async function handleBundleNavigate(messageId, slotIndex) {
    const msg = messages.find((m) => m.id === messageId)
    const entries = parseBundleEntries(msg?.bundleMessages)
    if (!entries || slotIndex < 0 || slotIndex >= entries.length) return
    const entry = entries[slotIndex]
    await updateMessage(messageId, {
      content: entry.content,
      promptData: entry.promptData,
      responseData: entry.responseData ?? null,
      apiDurationMs: entry.apiDurationMs ?? null,
      activeSlotIndex: slotIndex,
    })
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              content: entry.content,
              promptData: entry.promptData,
              responseData: entry.responseData ?? null,
              apiDurationMs: entry.apiDurationMs ?? null,
              activeSlotIndex: slotIndex,
            }
          : m,
      ),
    )
    setActiveSlotIndices((prev) => ({ ...prev, [messageId]: slotIndex }))
  }

  async function handleToggleCodeBlock(messageId, blockIndex) {
    const msg = messagesRef.current.find((m) => m.id === messageId)
    if (!msg) return
    const entries = parseBundleEntries(msg.bundleMessages)
    if (!entries || entries.length === 0) return

    const trackIdx = msg.activeSlotIndex ?? activeSlotIndices[messageId] ?? 0
    const idx = Math.min(trackIdx, entries.length - 1)
    const entry = { ...entries[idx] }
    const collapsed = new Set(entry.collapsedCodeBlocks || [])

    if (collapsed.has(blockIndex)) {
      collapsed.delete(blockIndex)
    } else {
      collapsed.add(blockIndex)
    }

    entry.collapsedCodeBlocks = [...collapsed].sort((a, b) => a - b)
    entries[idx] = entry
    const nextBundleJson = JSON.stringify(entries)

    await updateMessage(messageId, { bundleMessages: nextBundleJson })

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, bundleMessages: nextBundleJson } : m)),
    )

    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      if (isAtBottomRef.current) {
        el.scrollTop = el.scrollHeight
        setShowScrollButton(false)
      }
    })
  }

  async function handleToggleVisible(messageId, slotIndex, hidden) {
    const msg = messagesRef.current.find((m) => m.id === messageId)
    if (!msg) return
    const entries = parseBundleEntries(msg.bundleMessages)
    if (!entries || slotIndex < 0 || slotIndex >= entries.length) return
    const idx = Math.min(slotIndex, entries.length - 1)
    const entry = { ...entries[idx] }
    if (entry.isError) return
    entry.hidden = !!hidden
    entries[idx] = entry
    const nextBundleJson = JSON.stringify(entries)
    await updateMessage(messageId, { bundleMessages: nextBundleJson })
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, bundleMessages: nextBundleJson } : m)),
    )
  }

  async function handleRegenerate(messageId, skipConfirmation = false) {
    if (!skipConfirmation) {
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
    }

    if (generatingRef.current) return
    generatingRef.current = true
    isLocalStreamerRef.current = true

    let slotIndex = 0
    let outcome = 'failed'
    let regenEntries
    let throttledToken
    let currentPersona = null
    try {
      const idx = messages.findIndex((m) => m.id === messageId)
      if (idx === -1) return

      const msg = messages[idx]
      const isOOCRegen = !!msg.isOOC

      // Pre-flight profile check — must happen before any bundle slot mutations to avoid
      // leaving orphaned empty slots if the profile is missing.
      const profile = isOOCRegen
        ? await getEffectiveProfileFor('ooc')
        : await getEffectiveProfileFor('chat')
      if (!profile?.model) {
        showToast(t('noProfileModel'), { type: 'error' })
        return
      }

      let currentMsgs = messages.slice(0, idx)
      currentMsgs = withoutFailedMessages(currentMsgs)

      const lastMsgBefore = currentMsgs[currentMsgs.length - 1]
      const beforeDate = lastMsgBefore?.createdAt ? new Date(lastMsgBefore.createdAt) : null

      let chatPersona = null
      if (thread?.personaId) {
        chatPersona = await getPersona(thread.personaId)
      }

      currentPersona = selectedPersonaId ? await getPersona(selectedPersonaId) : chatPersona

      const isFirstMessage =
        currentMsgs.filter((m) => isRealMessage(m) && !isMessageHidden(m)).length === 0 &&
        character?.firstMessage

      regenEntries = parseBundleEntries(msg.bundleMessages)
      if (!regenEntries) {
        regenEntries = [
          {
            content: msg.content,
            promptData: msg.promptData || null,
            responseData: msg.responseData || null,
            apiDurationMs: msg.apiDurationMs ?? null,
          },
        ]
      }

      slotIndex = regenEntries.length
      regenEntries.push({
        content: '',
        promptData: null,
        createdAt: new Date().toISOString(),
        hidden: isOOCRegen && character?.includeOOC === false,
      })
      setStreamingSlotIndices((prev) => ({ ...prev, [messageId]: slotIndex }))
      setStreamingSlotIndex(threadId, slotIndex)
      if (Number(currentThreadIdRef.current) === Number(threadId)) {
        setActiveSlotIndices((prev) => ({ ...prev, [messageId]: slotIndex }))
      }
      const bundleJson = JSON.stringify(regenEntries)

      await updateMessage(messageId, {
        bundleMessages: bundleJson,
        content: '',
        promptData: null,
        activeSlotIndex: slotIndex,
      })
      setStreamingMessageId(threadId, messageId)
      setStreamingStartTime(messageId, Date.now())
      if (Number(currentThreadIdRef.current) === Number(threadId)) {
        setStreamingMsgId(messageId)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  bundleMessages: bundleJson,
                  content: '',
                  promptData: null,
                  activeSlotIndex: slotIndex,
                }
              : m,
          ),
        )
      }

      const streamSlotIntoBubble = (full) => {
        const entries = regenEntries.map((e, i) => (i === slotIndex ? { ...e, content: full } : e))
        const bundleJson = JSON.stringify(entries)
        updateMessage(messageId, {
          content: full,
          bundleMessages: bundleJson,
        })
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId ? { ...m, content: full, bundleMessages: bundleJson } : m,
            ),
          )
        }
      }
      throttledToken = createTrailingThrottle(streamSlotIntoBubble, 100)

      const regenAbortController = new AbortController()

      const result = await apiQueue.enqueue({
        threadId,
        type: 'regenerate',
        signal: regenAbortController.signal,
        controller: regenAbortController,
        execute: async (ctx) => {
          return await generateChatResponse({
            character,
            chatPersona,
            currentPersona,
            currentMsgs,
            isFirstMessage,
            isOOC: isOOCRegen,
            threadId,
            personaMap,
            signal: regenAbortController.signal,
            onToken: throttledToken,
            onFinish: (reason) => {
              if (reason === 'length' && Number(currentThreadIdRef.current) === Number(threadId)) {
                showToast(t('responseTruncated', { ns: 'chat' }), { type: 'warning' })
              }
            },
            ctx,
            beforeDate,
          })
        },
      }).promise

      throttledToken.cancel()

      if (result.status === 'no-profile') {
        // Pre-flight already caught this, but handle defensively: pop the slot
        regenEntries.pop()
        const cleanedBundle = JSON.stringify(regenEntries)
        await updateMessage(messageId, {
          bundleMessages: cleanedBundle,
          activeSlotIndex: regenEntries.length - 1,
        })
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, bundleMessages: cleanedBundle, activeSlotIndex: regenEntries.length - 1 }
                : m,
            ),
          )
        }
      }

      if (result.status === 'empty') {
        const finalEntries = regenEntries.map((e) => ({ ...e }))
        if (finalEntries[slotIndex]) {
          finalEntries[slotIndex].isError = true
          finalEntries[slotIndex].error = null
          finalEntries[slotIndex].hidden = true
        }
        await updateMessage(messageId, {
          bundleMessages: JSON.stringify(finalEntries),
          promptData: null,
        })
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          const msgs = await getMessagesByThread(threadId)
          setMessages(dedupeMessages(msgs))
        }
      }

      if (result.status === 'error') {
        const finalEntries = regenEntries.map((e) => ({ ...e }))
        if (finalEntries[slotIndex]) {
          finalEntries[slotIndex].isError = true
          finalEntries[slotIndex].error = result.error || null
          finalEntries[slotIndex].content = result.error || finalEntries[slotIndex].content || ''
          finalEntries[slotIndex].hidden = true
        }
        await updateMessage(messageId, {
          bundleMessages: JSON.stringify(finalEntries),
          content: finalEntries[slotIndex]?.content ?? '',
          promptData: null,
          activeSlotIndex: slotIndex,
        })
        const msgs = await getMessagesByThread(threadId)
        if (Number(currentThreadIdRef.current) === Number(threadId))
          setMessages(dedupeMessages(msgs))
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          showToast(result.error, { type: 'error' })
        }
      }

      if (result.status === 'success') {
        const finalEntries = regenEntries.map((e) => ({ ...e }))
        if (finalEntries[slotIndex]) {
          finalEntries[slotIndex].content = result.content
          finalEntries[slotIndex].promptData = result.promptData
          finalEntries[slotIndex].responseData = result.responseData
          finalEntries[slotIndex].apiDurationMs = result.apiDurationMs
          finalEntries[slotIndex].isError = false
          finalEntries[slotIndex].error = null
        }
        await updateMessage(messageId, {
          bundleMessages: JSON.stringify(finalEntries),
          content: result.content,
          promptData: result.promptData,
          responseData: result.responseData,
          apiDurationMs: result.apiDurationMs,
          activeSlotIndex: slotIndex,
        })
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    content: result.content,
                    bundleMessages: JSON.stringify(finalEntries),
                    promptData: result.promptData,
                    apiDurationMs: result.apiDurationMs,
                    activeSlotIndex: slotIndex,
                  }
                : m,
            ),
          )
          setActiveSlotIndices((prev) => ({ ...prev, [messageId]: slotIndex }))
        }
        outcome = 'succeeded'
      }
    } catch (err) {
      if (throttledToken) throttledToken.cancel()
      if (err.name === 'AbortError') {
        outcome = 'aborted'
        // Keep the streamed slot (with its partial content) instead of discarding it.
        // Read the latest bundle from the DB so we don't lose streamed content that
        // arrived after the local `regenEntries` snapshot was taken.
        const finalEntries = regenEntries.map((e) => ({ ...e }))
        if (finalEntries?.[slotIndex]) {
          finalEntries[slotIndex].isError = false
          finalEntries[slotIndex].error = null
          finalEntries[slotIndex].promptData = finalEntries[slotIndex].promptData || null
        }
        const keptBundle = JSON.stringify(finalEntries)
        await updateMessage(messageId, {
          bundleMessages: keptBundle,
          content: finalEntries?.[slotIndex]?.content ?? '',
          activeSlotIndex: slotIndex,
        })
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    bundleMessages: keptBundle,
                    content: finalEntries?.[slotIndex]?.content ?? '',
                    activeSlotIndex: slotIndex,
                  }
                : m,
            ),
          )
        }
      } else {
        const finalEntries = regenEntries.map((e) => ({ ...e }))
        if (finalEntries?.[slotIndex]) {
          finalEntries[slotIndex].isError = true
          finalEntries[slotIndex].error = err.message || null
          finalEntries[slotIndex].content = err.message || finalEntries[slotIndex].content || ''
        }
        await updateMessage(messageId, {
          bundleMessages: JSON.stringify(finalEntries),
          content: finalEntries?.[slotIndex]?.content ?? '',
          activeSlotIndex: slotIndex,
        })
        const msgs = await getMessagesByThread(threadId)
        if (Number(currentThreadIdRef.current) === Number(threadId))
          setMessages(dedupeMessages(msgs))
        if (Number(currentThreadIdRef.current) === Number(threadId)) {
          showToast(err.message, { type: 'error' })
        }
      }
    } finally {
      clearStreamingStartTime(messageId)
      clearStreamingMessageId(threadId)
      clearStreamingSlotIndex(threadId)
      isLocalStreamerRef.current = false
      setStreamingSlotIndices((prev) => {
        const next = { ...prev }
        delete next[messageId]
        return next
      })
      if (Number(currentThreadIdRef.current) === Number(threadId)) {
        setStreamingMsgId(null)
      }
      generatingRef.current = false
      generatingFetchIdRef.current += 1
      if (Number(currentThreadIdRef.current) === Number(threadId)) {
        setGenerating(false)
      }
      await runPostGenerationTasks({
        threadId,
        outcome,
        notifyMessageId: messageId,
        includeSummarization: true,
        currentPersona,
      })
    }
  }

  async function handleEditMessage(id, content) {
    const trimMsgs = await getSetting('prompting.trimMessages')
    const finalContent = trimMsgs ? trimLeadingTrailingNewlines(content) : content
    const msg = messages.find((m) => m.id === id)
    let entries = parseBundleEntries(msg?.bundleMessages)
    if (!entries) {
      entries = [
        {
          content: msg.content,
          promptData: msg.promptData || null,
          responseData: msg.responseData || null,
          apiDurationMs: msg.apiDurationMs ?? null,
        },
      ]
    }
    entries.push({
      content: finalContent,
      promptData: null,
      apiDurationMs: null,
      origin: 'edit',
      createdAt: new Date().toISOString(),
      hidden: msg.isOOC && character?.includeOOC === false,
    })
    await updateMessage(id, {
      bundleMessages: JSON.stringify(entries),
      content: finalContent,
      apiDurationMs: null,
      activeSlotIndex: entries.length - 1,
    })
    const msgs = await getMessagesByThread(threadId)
    setMessages(dedupeMessages(msgs))
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
        apiDurationMs: entries[newIdx].apiDurationMs ?? null,
        activeSlotIndex: newIdx,
      })
      setActiveSlotIndices((prev) => ({ ...prev, [id]: newIdx }))
      const msgs = await getMessagesByThread(threadId)
      setMessages(dedupeMessages(msgs))
      showToast(t('messageDeleted'), { type: 'success' })
      return
    }
    setActiveSlotIndices((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    await deleteMessage(id)

    if (msg?.createdAt) {
      const thr = await getThread(threadId)
      if (thr?.lastSummarizationAt && msg.createdAt > thr.lastSummarizationAt) {
        const chr = thr?.characterId ? await getCharacter(thr.characterId) : null
        const rollover =
          chr?.messageRollover ?? (await getSetting('defaultMessageRollover')) ?? 'rollover'
        if (rollover === 'rollover') {
          const current = Number(thr.keptConsumedCount) || 0
          if (current > 0) {
            await updateThread(threadId, { keptConsumedCount: current - 1 })
          }
        }
      }
    }

    const msgs = await getMessagesByThread(threadId)
    setMessages(dedupeMessages(msgs))
    showToast(t('messageDeleted'), { type: 'success' })
  }

  const { confirm } = useConfirm()

  async function handleDeleteAllSlots(id) {
    const ok = await confirm({
      title: t('deleteAllConfirmTitle'),
      message: t('deleteAllConfirmMessage'),
      confirmLabel: t('delete'),
      variant: 'danger',
    })
    if (!ok) return
    const delMsg = messages.find((m) => m.id === id)
    await deleteMessage(id)
    setActiveSlotIndices((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })

    if (delMsg?.createdAt) {
      const thr = await getThread(threadId)
      if (thr?.lastSummarizationAt && delMsg.createdAt > thr.lastSummarizationAt) {
        const chr = thr?.characterId ? await getCharacter(thr.characterId) : null
        const rollover =
          chr?.messageRollover ?? (await getSetting('defaultMessageRollover')) ?? 'rollover'
        if (rollover === 'rollover') {
          const current = Number(thr.keptConsumedCount) || 0
          if (current > 0) {
            await updateThread(threadId, { keptConsumedCount: current - 1 })
          }
        }
      }
    }

    setMessages(dedupeMessages(await getMessagesByThread(threadId)))
    showToast(t('messageDeleted'), { type: 'success' })
  }

  async function handleDeleteFromHere(id) {
    const ok = await confirm({
      title: t('deleteFromHereConfirmTitle'),
      message: t('deleteFromHereConfirmMessage'),
      confirmLabel: t('delete'),
      variant: 'danger',
    })
    if (!ok) return
    const idx = messages.findIndex((m) => m.id === id)
    const deletedIds = idx === -1 ? new Set() : new Set(messages.slice(idx).map((m) => m.id))

    const thr = await getThread(threadId)
    let postSummDeletedCount = 0
    if (thr?.lastSummarizationAt && idx !== -1) {
      postSummDeletedCount = messages
        .slice(idx)
        .filter(
          (m) =>
            !m.isSummaryMarker && !m.isAutoTitleMarker && m.createdAt > thr.lastSummarizationAt,
        ).length
    }

    await deleteMessagesFrom(id)
    setActiveSlotIndices((prev) => {
      const next = { ...prev }
      deletedIds.forEach((d) => delete next[d])
      return next
    })

    if (postSummDeletedCount > 0 && thr) {
      const chr = thr?.characterId ? await getCharacter(thr.characterId) : null
      const rollover =
        chr?.messageRollover ?? (await getSetting('defaultMessageRollover')) ?? 'rollover'
      if (rollover === 'rollover') {
        const current = Number(thr.keptConsumedCount) || 0
        const restored = Math.min(postSummDeletedCount, current)
        if (restored > 0) {
          await updateThread(threadId, { keptConsumedCount: current - restored })
        }
      }
    }

    setMessages(dedupeMessages(await getMessagesByThread(threadId)))
    showToast(t('messageDeleted'), { type: 'success' })
  }

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
    return character?.displayName || character?.name || null
  }

  const deletedMsgNumber = confirmDeleteId
    ? messages.findIndex((m) => m.id === confirmDeleteId) + 1
    : null

  const summarizationProgress = useMemo(() => {
    if (!character) return null
    const resolvedMemory = character.memory ?? memoryDefaults.mode
    if (resolvedMemory === 'never') return null

    const includeOOC = character.includeOOC !== false
    const unsummarized = getUnsummarizedMessages(messages, { includeOOC })

    if (resolvedMemory === 'messages') {
      const threshold = Number(character.messagesThreshold ?? memoryDefaults.messagesThreshold)
      const remaining = threshold - unsummarized.length
      if (remaining <= 0) return null
      return { mode: 'messages', remaining, threshold, current: unsummarized.length }
    }

    if (resolvedMemory === 'contextWindow') {
      const threshold = Number(
        character.contextWindowThreshold ?? memoryDefaults.contextWindowThreshold,
      )
      const tokenCount = unsummarized.reduce(
        (total, message) => total + estimateTokens(message?.content || ''),
        0,
      )
      const remaining = threshold - tokenCount
      if (remaining <= 0) return null
      return { mode: 'contextWindow', remaining, threshold, current: tokenCount }
    }

    return null
  }, [character, messages, memoryDefaults])

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

  const msgNumMap = new Map()
  let _msgNum = 0
  for (const m of messages) {
    if (m.isSummaryMarker || m.isAutoTitleMarker) continue
    _msgNum++
    msgNumMap.set(m.id, _msgNum)
  }

  const visibleMessages = visibleStartIndex > 0 ? messages.slice(visibleStartIndex) : messages

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto relative pb-4">
        <div className="sticky top-0 z-10 bg-surface flex items-center justify-between px-4 md:px-8 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            {character && (
              <Avatar
                src={character.avatar}
                size="sm"
                className="flex-shrink-0 cursor-pointer"
                onClick={() => openModal('characterCreate', { character })}
              />
            )}
            <div className="flex items-center gap-2 min-w-0">
              {character && (
                <h1 className="font-semibold text-text shrink-0">
                  {character.displayName || character.name}
                </h1>
              )}
              <ChatTitle
                title={thread.title}
                chatTitleMarquee={chatTitleMarquee}
                onDoubleClick={() => openModal('editThreadTitle', { thread })}
              />
            </div>
            {blockingGenerating && (
              <RefreshCw className="w-4 h-4 text-primary animate-spin shrink-0" />
            )}
            {blockingQueued && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white bg-primary rounded-full shrink-0">
                {queuedCount}
              </span>
            )}
          </div>
        </div>

        {thread?.activeScenario?.content?.trim() && (
          <ScenarioStatusBar
            scenario={thread.activeScenario}
            charName={character?.name || ''}
            userName={personaMap?.[thread?.personaId]?.name || ''}
          />
        )}

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
              {visibleMessages.map((msg, sliceIdx) => {
                const idx = visibleStartIndex + sliceIdx
                if (msg.isSummaryMarker) {
                  const isVisible = idx >= visibleStartIndex
                  let nextIdx = idx + 1
                  while (nextIdx < messages.length && messages[nextIdx].isSummaryMarker) nextIdx++
                  const nextVisible = nextIdx >= messages.length || nextIdx >= visibleStartIndex
                  if (!isVisible || !nextVisible) return null
                  const summPending = pendingMarkers.find((m) => m.type === 'summarization')
                  const summStatus = summPending?.status
                  return (
                    <div key={msg.id} className="flex items-center gap-3 my-2 px-1">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-tertiary uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
                        {summStatus && (
                          <button
                            type="button"
                            onClick={handleCancelSummarization}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-error hover:bg-error/10 transition-colors"
                            title={t('cancelConfirmTitle')}
                          >
                            <Square className="w-3 h-3" />
                          </button>
                        )}
                        {t('summarizationMarker')}
                        {summStatus === 'queued' && <Clock className="w-3 h-3" />}
                        {summStatus === 'active' && <RefreshCw className="w-3 h-3 animate-spin" />}
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
                  const nextVisible = nextIdx >= messages.length || nextIdx >= visibleStartIndex
                  if (!isVisible || !nextVisible) return null
                  const autoTitlePending = pendingMarkers.find((m) => m.type === 'autoTitle')
                  const atStatus = autoTitlePending?.status
                  return (
                    <div key={msg.id} className="flex items-center gap-3 my-2 px-1">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-tertiary uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
                        {atStatus && (
                          <button
                            type="button"
                            onClick={handleCancelAutoTitle}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-error hover:bg-error/10 transition-colors"
                            title={t('cancelConfirmTitle')}
                          >
                            <Square className="w-3 h-3" />
                          </button>
                        )}
                        {t('autoTitleMarker')}
                        {atStatus === 'queued' && <Clock className="w-3 h-3" />}
                        {atStatus === 'active' && <RefreshCw className="w-3 h-3 animate-spin" />}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )
                }

                const entries = parseBundleEntries(msg.bundleMessages)
                const bundleMessages = entries
                const trackIdx = msg.activeSlotIndex ?? activeSlotIndices[msg.id]
                const bundleIndex =
                  trackIdx != null && bundleMessages
                    ? Math.min(trackIdx, bundleMessages.length - 1)
                    : bundleMessages && msg.content
                      ? Math.max(
                          0,
                          bundleMessages.findIndex((e) => e?.content === msg.content),
                        )
                      : 0
                const collapsedCodeBlocks =
                  entries && bundleIndex >= 0 && bundleIndex < entries.length
                    ? entries[bundleIndex].collapsedCodeBlocks || null
                    : null
                const currentOrigin =
                  entries && bundleIndex >= 0 && bundleIndex < entries.length
                    ? entries[bundleIndex].origin || null
                    : null
                const slotCreatedAt = entries?.[bundleIndex]?.createdAt || msg.createdAt
                const bundleEntry = entries?.[bundleIndex]
                const slotApiDurationMs = entries
                  ? (bundleEntry?.apiDurationMs ?? null)
                  : (msg.apiDurationMs ?? null)
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
                      messageNumber={msgNumMap.get(msg.id)}
                      avatarSrc={getAvatarSrc(msg)}
                      avatarScale={getAvatarScale(msg)}
                      role={msg.role}
                      personaMap={personaMap}
                      nameLabel={getMessageName(msg)}
                      streaming={msg.id === streamingMsgId}
                      streamingSlotIndex={streamingSlotIndices[msg.id]}
                      bundleMessages={bundleMessages}
                      bundleIndex={bundleIndex}
                      collapsedCodeBlocks={collapsedCodeBlocks}
                      currentOrigin={currentOrigin}
                      slotCreatedAt={slotCreatedAt}
                      apiDurationMs={slotApiDurationMs}
                      onBundleNavigate={handleBundleNavigate}
                      onDeleteRequest={(id) => setConfirmDeleteId(id)}
                      onDeleteAllSlots={handleDeleteAllSlots}
                      onDeleteFromHere={handleDeleteFromHere}
                      onEdit={handleEditMessage}
                      onFork={handleForkMessage}
                      onRegenerate={handleRegenerate}
                      onSpeak={() => {}}
                      generating={blockingGenerating}
                      requestFailed={isFailedSlot}
                      errorText={errorText}
                      isUnread={msg.isUnread || false}
                      character={character}
                      personaName={personaMap?.[thread?.personaId]?.name || ''}
                      onToggleCodeBlock={handleToggleCodeBlock}
                      onToggleVisible={handleToggleVisible}
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
              className="sticky bottom-4 left-1/2 -translate-x-1/2 size-[44px] flex items-center justify-center bg-primary text-on-primary rounded-full shadow-surface-lg hover:bg-primary-hover transition-all duration-200 relative"
              aria-label={t('scrollToBottom')}
            >
              <ChevronDown className="w-5 h-5" />
              {(thread?.unreadCount || 0) > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-badge-unread-text bg-badge-unread rounded-full leading-none">
                  {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-border bg-surface">
        {' '}
        {/* Wrap input for better control */}
        {showStatus && chatModelName && (
          // <div className="px-3 py-1.5 text-center">
          <div className="px-3 text-center">
            {chatProfile ? (
              <button
                type="button"
                onClick={() => openModal('profileForm', { profile: chatProfile })}
                className="text-xs text-tertiary hover:text-text hover:underline inline-flex items-center gap-1 max-w-full"
                title={t('statusBar.editProfile')}
              >
                {chatModelTemp != null && <>{chatModelTemp}t · </>}
                {chatModelTopP != null && <>{chatModelTopP}p · </>}
                <MarqueeText className="inline-block align-bottom max-w-full">
                  {chatModelName.split('/').pop()}
                </MarqueeText>
                {hordeEta && <> · {hordeEta}</>}
              </button>
            ) : (
              <span className="text-xs text-tertiary">
                {chatModelTemp != null && <>{chatModelTemp}t · </>}
                {chatModelTopP != null && <>{chatModelTopP}p · </>}
                <MarqueeText className="inline-block align-bottom max-w-full">
                  {chatModelName.split('/').pop()}
                </MarqueeText>
                {hordeEta && <> · {hordeEta}</>}
              </span>
            )}
          </div>
        )}
        {summarizationProgress && (
          <div className="px-3 py-1 text-center">
            <span className="text-xs text-tertiary">
              {summarizationProgress.mode === 'messages'
                ? t('summarizationProgressMessages', { count: summarizationProgress.remaining })
                : t('summarizationProgressTokens', {
                    current: summarizationProgress.current,
                    threshold: summarizationProgress.threshold,
                  })}
            </span>
          </div>
        )}
        <ChatInputArea
          threadId={threadId}
          onSend={handleSend}
          onCancel={handleCancel}
          generating={blockingGenerating}
          autoTitling={autoTitling}
          hasQueued={blockingQueued}
          onPersonaChange={setSelectedPersonaId}
          onOocChange={setOocActive}
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
