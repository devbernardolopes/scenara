import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, RefreshCw } from '../lib/icons'
import { useModal } from '../hooks/useModal'
import { showToast } from '../lib/toast'
import { useConfirm } from '../lib/confirm'
import Avatar from '../components/shared/Avatar'
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
  updateMessage,
  deleteMessagesFrom,
} from '../services/messages'
import { getWritingInstruction } from '../services/writingInstructions'
import { getEffectiveProfileFor } from '../services/connectionProfiles'
import { sendChatCompletion, buildMessagesPayload, getActiveParams } from '../services/chatApi'
import { getSetting } from '../services/settings'
import { startGenerating, stopGenerating } from '../services/generatingState'
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
        {title}
      </span>
    )
  }

  return (
    <span
      ref={wrapperRef}
      className={`text-sm text-secondary marquee-wrapper ${overflows ? 'marquee-animate' : ''} cursor-pointer`}
      onDoubleClick={onDoubleClick}
    >
      <span className="marquee-text">{title}</span>
    </span>
  )
}

function ChatView() {
  const { threadId } = useParams()
  const { t } = useTranslation('chat')
  const { openModal } = useModal()
  const messagesEndRef = useRef(null)
  const scrollRef = useRef(null)
  const abortRef = useRef(null)
  const generatingRef = useRef(false)
  const autoTriggeredRef = useRef(false)
  const handleSendRef = useRef(null)
  const scrollCommits = useRef(0)
  const [thread, setThread] = useState(null)
  const [character, setCharacter] = useState(null)
  const [personaMap, setPersonaMap] = useState({})
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [streamingMsgId, setStreamingMsgId] = useState(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [noChatProfile, setNoChatProfile] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [charAvatarScale, setCharAvatarScale] = useState('1x')
  const [personaAvatarScale, setPersonaAvatarScale] = useState('1x')
  const [visibleStartIndex, setVisibleStartIndex] = useState(0)
  const [messageThreshold, setMessageThreshold] = useState(0)
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
        }))
        const msgId = await createAssistantMessage(threadId, entries[0].content)
        await updateMessage(msgId, { bundleMessages: JSON.stringify(entries) })
        await updateThread(threadId, { initialMessages: null })
        thr = await getThread(threadId)
        msgs = await getMessagesByThread(threadId)
      }

      setThread(thr)
      setMessages(msgs)

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

      await loadPersonas()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    scrollCommits.current = 0
    loadData()
  }, [threadId])

  useEffect(() => {
    document.title = thread?.title ? `Scenara - ${thread.title}` : 'Scenara'
  }, [thread?.title])

  useLayoutEffect(() => {
    scrollCommits.current++
    if (messages.length > 0 && scrollCommits.current === 1) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    }
  }, [messages])

  useEffect(() => {
    if (messages.length > 0 && scrollCommits.current > 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    setVisibleStartIndex((prev) => Math.min(prev, messages.length))
  }, [messages])

  useEffect(() => {
    function onSettingsChanged(e) {
      if (e.detail?.key === 'defaultMessageThreshold') {
        const newThreshold = Number(e.detail.value) || 0
        setMessageThreshold(newThreshold)
        setVisibleStartIndex((prev) => {
          if (newThreshold === 0) return 0
          const defaultStart = Math.max(0, messages.length - newThreshold)
          return Math.min(prev, defaultStart)
        })
      }
    }
    window.addEventListener('settings-changed', onSettingsChanged)
    return () => window.removeEventListener('settings-changed', onSettingsChanged)
  }, [messages.length])

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

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setShowScrollButton(el.scrollHeight - el.scrollTop - el.clientHeight > 100)
  }, [])

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

  async function handleCancel() {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }

  async function doChatRequest(isFirstMessage, currentMsgs, chatPersona, currentPersona) {
    const profile = await getEffectiveProfileFor('chat')
    if (!profile?.model) {
      showToast('No Chat profile configured or model selected.', { type: 'error' })
      return
    }

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
      personaInjectionPlacement: await getSetting('personaInjectionPlacement'),
    }

    const payload = await buildMessagesPayload({
      character,
      chatPersona,
      currentPersona,
      messages: currentMsgs,
      isFirstMessage,
      settings,
      writingInstruction,
    })

    const activeParams = getActiveParams(profile)
    const promptData = JSON.stringify({ payload, model: profile.model, params: activeParams })

    const assistantMsgId = await createAssistantMessage(threadId, '')
    await updateMessage(assistantMsgId, { promptData })
    setStreamingMsgId(assistantMsgId)
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMsgId,
        threadId: Number(threadId),
        role: 'assistant',
        content: '',
        createdAt: new Date(),
      },
    ])

    abortRef.current = new AbortController()

    try {
      const content = await sendChatCompletion({
        profile,
        messages: payload,
        signal: abortRef.current.signal,
        onToken: (fullContent) => {
          updateMessage(assistantMsgId, { content: fullContent })
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullContent } : m)),
          )
        },
      })

      await updateMessage(assistantMsgId, { content })
      setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, content } : m)))
      showToast(t('messageUpdated'), { type: 'success' })
    } catch (err) {
      if (err.name === 'AbortError') {
        await updateMessage(assistantMsgId, { content: '' })
        const msgs = await getMessagesByThread(threadId)
        setMessages(msgs)
      } else {
        await updateMessage(assistantMsgId, { content: '' })
        const msgs = await getMessagesByThread(threadId)
        setMessages(msgs)
        showToast(err.message, { type: 'error' })
      }
    } finally {
      setStreamingMsgId(null)
      abortRef.current = null
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
        await createMessage(threadId, 'user', text, personaId, isOOC)
        currentMsgs = await getMessagesByThread(threadId)
        setMessages(currentMsgs)
      }

      if (text && !autoReply) {
        generatingRef.current = false
        setGenerating(false)
        stopGenerating(threadId)
        return
      }

      const currentPersona = personaId ? await getPersona(personaId) : null
      await doChatRequest(isFirstMessage, currentMsgs, chatPersona, currentPersona)

      const msgs = await getMessagesByThread(threadId)
      setMessages(msgs)
    } finally {
      generatingRef.current = false
      setGenerating(false)
      stopGenerating(threadId)
    }
  }

  useEffect(() => {
    handleSendRef.current = handleSend
  })

  async function handleBundleNavigate(messageId, newContent) {
    const msg = messages.find((m) => m.id === messageId)
    const entries = parseBundleEntries(msg?.bundleMessages)
    let newPromptData = null
    if (entries) {
      const entry = entries.find((e) => e.content === newContent)
      if (entry) newPromptData = entry.promptData
    }
    await updateMessage(messageId, { content: newContent, promptData: newPromptData })
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, content: newContent, promptData: newPromptData } : m,
      ),
    )
  }

  async function handleRegenerate(messageId) {
    if (generatingRef.current) return
    generatingRef.current = true
    setGenerating(true)
    startGenerating(threadId)

    try {
      const idx = messages.findIndex((m) => m.id === messageId)
      if (idx === -1) return

      const msg = messages[idx]

      let entries = parseBundleEntries(msg.bundleMessages)
      if (!entries) {
        entries = [{ content: msg.content, promptData: msg.promptData || null }]
      }

      const slotIndex = entries.length
      entries.push({ content: '', promptData: null })
      const bundleJson = JSON.stringify(entries)

      await updateMessage(messageId, { bundleMessages: bundleJson, content: '' })
      setStreamingMsgId(messageId)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, bundleMessages: bundleJson, content: '' } : m,
        ),
      )

      const currentMsgs = messages.slice(0, idx)
      let chatPersona = null
      if (thread?.personaId) {
        chatPersona = await getPersona(thread.personaId)
      }

      const isFirstMessage = currentMsgs.length === 0 && character?.firstMessage

      const profile = await getEffectiveProfileFor('chat')
      if (!profile?.model) {
        showToast('No Chat profile configured or model selected.', { type: 'error' })
        return
      }

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
        personaInjectionPlacement: await getSetting('personaInjectionPlacement'),
      }

      const payload = await buildMessagesPayload({
        character,
        chatPersona,
        currentPersona: null,
        messages: currentMsgs,
        isFirstMessage,
        settings,
        writingInstruction,
      })

      const activeParams = getActiveParams(profile)
      const promptDataStr = JSON.stringify({ payload, model: profile.model, params: activeParams })

      entries[slotIndex].promptData = promptDataStr
      await updateMessage(messageId, {
        bundleMessages: JSON.stringify(entries),
        promptData: promptDataStr,
      })

      abortRef.current = new AbortController()

      const content = await sendChatCompletion({
        profile,
        messages: payload,
        signal: abortRef.current.signal,
        onToken: (fullContent) => {
          updateMessage(messageId, { content: fullContent })
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, content: fullContent } : m)),
          )
        },
      })

      const dbMsg = await db.messages.get(Number(messageId))
      const finalEntries = parseBundleEntries(dbMsg?.bundleMessages) || entries
      if (finalEntries[slotIndex]) {
        finalEntries[slotIndex].content = content
        finalEntries[slotIndex].promptData = promptDataStr
      }
      await updateMessage(messageId, {
        bundleMessages: JSON.stringify(finalEntries),
        content,
        promptData: promptDataStr,
      })
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content,
                bundleMessages: JSON.stringify(finalEntries),
                promptData: promptDataStr,
              }
            : m,
        ),
      )
      showToast(t('messageUpdated'), { type: 'success' })
    } catch (err) {
      const msgs = await getMessagesByThread(threadId)
      setMessages(msgs)
      if (err.name !== 'AbortError') {
        showToast(err.message, { type: 'error' })
      }
    } finally {
      setStreamingMsgId(null)
      generatingRef.current = false
      setGenerating(false)
      stopGenerating(threadId)
      abortRef.current = null
    }
  }

  async function handleEditMessage(id, content) {
    const msg = messages.find((m) => m.id === id)
    let entries = parseBundleEntries(msg?.bundleMessages)
    if (!entries) {
      entries = [{ content: msg.content, promptData: msg.promptData || null }]
    }
    entries.push({ content, promptData: null, origin: 'edit' })
    await updateMessage(id, { bundleMessages: JSON.stringify(entries), content })
    const msgs = await getMessagesByThread(threadId)
    setMessages(msgs)
    showToast(t('messageUpdated'), { type: 'success' })
  }

  async function handleDeleteMessage(id) {
    setConfirmDeleteId(null)
    const msg = messages.find((m) => m.id === id)
    const entries = parseBundleEntries(msg?.bundleMessages)
    if (entries && entries.length > 1) {
      const idx = entries.findIndex((e) => e.content === msg.content)
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
      const msgs = await getMessagesByThread(threadId)
      setMessages(msgs)
      showToast(t('messageDeleted'), { type: 'success' })
      return
    }
    await deleteMessagesFrom(id)
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
    await forkThread(threadId, messageId)
  }

  function getAvatarSrc(msg) {
    if (msg.role === 'user') return personaMap[msg.personaId]?.avatar || null
    return character?.avatar || null
  }

  function getAvatarScale(msg) {
    return msg.role === 'user' ? personaAvatarScale : charAvatarScale
  }

  function getMessageName(msg) {
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
      <div className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-border">
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
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-4 relative"
      >
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
            {messages.slice(visibleStartIndex).map((msg, idx) => {
              const entries = parseBundleEntries(msg.bundleMessages)
              const bundleMessages = entries ? entries.map((e) => e.content) : null
              const bundleIndex =
                bundleMessages && msg.content ? Math.max(0, bundleMessages.indexOf(msg.content)) : 0
              const currentOrigin =
                entries && bundleIndex >= 0 && bundleIndex < entries.length
                  ? entries[bundleIndex].origin || null
                  : null
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  messageNumber={visibleStartIndex + idx + 1}
                  avatarSrc={getAvatarSrc(msg)}
                  avatarScale={getAvatarScale(msg)}
                  role={msg.role}
                  personaMap={personaMap}
                  nameLabel={getMessageName(msg)}
                  streaming={msg.id === streamingMsgId}
                  bundleMessages={bundleMessages}
                  bundleIndex={bundleIndex}
                  currentOrigin={currentOrigin}
                  onBundleNavigate={handleBundleNavigate}
                  onDeleteRequest={(id) => setConfirmDeleteId(id)}
                  onEdit={handleEditMessage}
                  onFork={handleForkMessage}
                  onRegenerate={handleRegenerate}
                  onSpeak={() => {}}
                  generating={generating}
                  charName={character?.name || ''}
                  personaName={personaMap[thread?.personaId]?.name || ''}
                />
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
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}
      </div>

      <ChatInputArea
        threadId={threadId}
        onSend={handleSend}
        onCancel={handleCancel}
        generating={generating}
      />

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
