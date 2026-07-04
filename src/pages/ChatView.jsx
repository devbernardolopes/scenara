import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown, RefreshCw } from '../lib/icons'
import { useModal } from '../hooks/useModal'
import { showToast } from '../lib/toast'
import Avatar from '../components/shared/Avatar'
import ChatInputArea from '../components/chat/ChatInputArea'
import MessageBubble from '../components/chat/MessageBubble'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import { getThread } from '../services/threads'
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
import { sendChatCompletion, buildMessagesPayload } from '../services/chatApi'
import { getSetting } from '../services/settings'
import { startGenerating, stopGenerating } from '../services/generatingState'

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
  const [lastPayload, setLastPayload] = useState(null)
  const [lastModel, setLastModel] = useState(null)
  const [lastParams, setLastParams] = useState(null)

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
      const [thr, msgs] = await Promise.all([getThread(threadId), getMessagesByThread(threadId)])
      setThread(thr)
      setMessages(msgs)
      if (thr) {
        const chr = await getCharacter(thr.characterId)
        setCharacter(chr)
      }
      const chatProfileId = await getSetting('requestKind.chat.profileId')
      setNoChatProfile(!chatProfileId)

      await Promise.all([
        loadPersonas(),
        getSetting('defaultCharacterAvatarScale').then((v) => setCharAvatarScale(v || '1x')),
        getSetting('defaultUserPersonaAvatarScale').then((v) => setPersonaAvatarScale(v || '1x')),
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [threadId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    function onPersonasChanged() {
      loadPersonas()
    }
    function onCharactersChanged() {
      if (thread) getCharacter(thread.characterId).then(setCharacter)
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
      !character.initialMessages?.length &&
      character.firstMessage
    ) {
      autoTriggeredRef.current = true
      handleSendRef.current?.('', null, false)
    }
  }, [loading, character, noChatProfile])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setShowScrollButton(el.scrollHeight - el.scrollTop - el.clientHeight > 100)
  }, [])

  function scrollToBottom() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    setShowScrollButton(false)
  }

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
      writingInstruction = await getWritingInstruction(character.writingInstruction)
    }

    const settings = {
      firstMessageRole: await getSetting('prompting.firstMessageRole'),
      firstMessagePrompt: await getSetting('prompting.firstMessagePrompt'),
      continueRole: await getSetting('prompting.continueRole'),
      continuePrompt: await getSetting('prompting.continuePrompt'),
      personaInjectionTemplate: await getSetting('prompting.personaInjectionTemplate'),
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

    setLastPayload(payload)
    setLastModel(profile.model)
    setLastParams(profile.params)

    const assistantMsgId = await createAssistantMessage(threadId, '')
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

  async function handleSend(text, personaId, isOOC) {
    if (generatingRef.current) return
    generatingRef.current = true
    setGenerating(true)
    startGenerating(threadId)

    const isFirstMessage =
      !character?.initialMessages?.length && !messages.some((m) => m.role === 'user')

    if (isFirstMessage && !text && !character?.firstMessage) {
      generatingRef.current = false
      setGenerating(false)
      stopGenerating(threadId)
      return
    }

    try {
      let currentMsgs = messages
      let chatPersona = null

      if (thread?.personaId) {
        chatPersona = await getPersona(thread.personaId)
      }

      if (text) {
        await createMessage(threadId, 'user', text, personaId, isOOC)
        currentMsgs = await getMessagesByThread(threadId)
        setMessages(currentMsgs)
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

  async function handleRegenerate(messageId) {
    if (generatingRef.current) return
    generatingRef.current = true
    setGenerating(true)
    startGenerating(threadId)

    try {
      const idx = messages.findIndex((m) => m.id === messageId)
      if (idx === -1) return

      await deleteMessagesFrom(messageId)
      const currentMsgs = messages.slice(0, idx)
      setMessages(currentMsgs)

      let chatPersona = null
      if (thread?.personaId) {
        chatPersona = await getPersona(thread.personaId)
      }

      const isFirstMessage =
        !character?.initialMessages?.length && !currentMsgs.some((m) => m.role === 'user')

      await doChatRequest(isFirstMessage, currentMsgs, chatPersona, null)

      const msgs = await getMessagesByThread(threadId)
      setMessages(msgs)
    } finally {
      generatingRef.current = false
      setGenerating(false)
      stopGenerating(threadId)
    }
  }

  async function handleEditMessage(id, content) {
    await updateMessage(id, { content })
    const msgs = await getMessagesByThread(threadId)
    setMessages(msgs)
    showToast(t('messageUpdated'), { type: 'success' })
  }

  async function handleDeleteMessage(id) {
    setConfirmDeleteId(null)
    await deleteMessagesFrom(id)
    const msgs = await getMessagesByThread(threadId)
    setMessages(msgs)
    showToast(t('messageDeleted'), { type: 'success' })
  }

  function getAvatarSrc(msg) {
    if (msg.role === 'user') return personaMap[msg.personaId]?.avatar || null
    return character?.avatar || null
  }

  function getAvatarScale(msg) {
    return msg.role === 'user' ? personaAvatarScale : charAvatarScale
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
          <h1 className="font-semibold text-text truncate">{character?.name || thread.title}</h1>
          <span className="text-xs text-tertiary bg-surface-secondary px-2 py-0.5 rounded">
            {t('characterTag')}
          </span>
          {generating && <RefreshCw className="w-4 h-4 text-primary animate-spin" />}
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
          messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              messageNumber={idx + 1}
              avatarSrc={getAvatarSrc(msg)}
              avatarScale={getAvatarScale(msg)}
              role={msg.role}
              personaMap={personaMap}
              streaming={msg.id === streamingMsgId}
              onDeleteRequest={(id) => setConfirmDeleteId(id)}
              onEdit={handleEditMessage}
              onFork={() => {}}
              onRegenerate={handleRegenerate}
              onSpeak={() => {}}
              onShowPrompt={() =>
                openModal('showPrompt', {
                  payload: lastPayload,
                  model: lastModel,
                  params: lastParams,
                })
              }
            />
          ))
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
