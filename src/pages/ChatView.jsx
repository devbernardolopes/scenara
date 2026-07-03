import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Avatar from '../components/shared/Avatar'
import ChatInputArea from '../components/chat/ChatInputArea'
import { getThread } from '../services/threads'
import { getCharacter } from '../services/characters'
import { getMessagesByThread, createMessage } from '../services/messages'

function ChatView() {
  const { threadId } = useParams()
  const { t } = useTranslation('chat')
  const messagesEndRef = useRef(null)
  const [thread, setThread] = useState(null)
  const [character, setCharacter] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

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

  async function handleSend(text) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    try {
      await createMessage(threadId, 'user', trimmed)
      const msgs = await getMessagesByThread(threadId)
      setMessages(msgs)
    } finally {
      setSending(false)
    }
  }

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

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-4">
        {messages.length === 0 ? (
          <p className="text-secondary text-sm text-center py-8">{t('placeholder')}</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] md:max-w-[65%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-primary text-on-primary'
                    : msg.role === 'system'
                      ? 'bg-surface-secondary text-secondary text-sm italic'
                      : 'bg-surface-secondary text-text'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className="text-xs mt-1 opacity-60">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInputArea threadId={threadId} defaultPersonaId={thread?.personaId} onSend={handleSend} />
    </div>
  )
}

export default ChatView
