import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from '../lib/icons'
import { showToast } from '../lib/toast'
import Avatar from '../components/shared/Avatar'
import ChatInputArea from '../components/chat/ChatInputArea'
import MessageBubble from '../components/chat/MessageBubble'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import { getThread } from '../services/threads'
import { getCharacter } from '../services/characters'
import { getAllPersonas } from '../services/personas'
import {
  getMessagesByThread,
  createMessage,
  updateMessage,
  deleteMessagesFrom,
} from '../services/messages'
import { getSetting } from '../services/settings'

function ChatView() {
  const { threadId } = useParams()
  const { t } = useTranslation('chat')
  const messagesEndRef = useRef(null)
  const scrollRef = useRef(null)
  const [thread, setThread] = useState(null)
  const [character, setCharacter] = useState(null)
  const [personaMap, setPersonaMap] = useState({})
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [charAvatarScale, setCharAvatarScale] = useState('1x')
  const [personaAvatarScale, setPersonaAvatarScale] = useState('1x')

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

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setShowScrollButton(el.scrollHeight - el.scrollTop - el.clientHeight > 100)
  }, [])

  function scrollToBottom() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    setShowScrollButton(false)
  }

  async function handleSend(text, personaId) {
    const trimmed = text?.trim()
    if (!trimmed || sending) return
    setSending(true)
    try {
      await createMessage(threadId, 'user', trimmed, personaId)
      const msgs = await getMessagesByThread(threadId)
      setMessages(msgs)
    } finally {
      setSending(false)
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          {character && <Avatar src={character.avatar} size="sm" className="flex-shrink-0" />}
          <h1 className="font-semibold text-text truncate">{character?.name || thread.title}</h1>
          <span className="text-xs text-tertiary bg-surface-secondary px-2 py-0.5 rounded">
            {t('characterTag')}
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-4 relative"
      >
        {messages.length === 0 ? (
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
              onDeleteRequest={(id) => setConfirmDeleteId(id)}
              onEdit={handleEditMessage}
              onFork={() => {}}
              onRegenerate={() => {}}
              onSpeak={() => {}}
              onShowPrompt={() => {}}
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

      <ChatInputArea threadId={threadId} defaultPersonaId={thread?.personaId} onSend={handleSend} />

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
