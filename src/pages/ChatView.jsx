import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useModal } from '../hooks/useModal'
import { getThread, deleteThread } from '../services/threads'
import { getCharacter } from '../services/characters'
import { getMessagesByThread, createMessage } from '../services/messages'

function ChatView() {
  const { threadId } = useParams()
  const { t } = useTranslation('chat')
  const { openModal } = useModal()
  const navigate = useNavigate()
  const messagesEndRef = useRef(null)
  const [thread, setThread] = useState(null)
  const [character, setCharacter] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const [thr, msgs] = await Promise.all([
        getThread(threadId),
        getMessagesByThread(threadId),
      ])
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

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await createMessage(threadId, 'user', text)
      setInput('')
      const msgs = await getMessagesByThread(threadId)
      setMessages(msgs)
    } finally {
      setSending(false)
    }
  }

  async function handleDelete() {
    await deleteThread(threadId)
    window.dispatchEvent(new CustomEvent('threads-changed'))
    navigate('/')
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
          {character && <span className="text-xl flex-shrink-0">{character.avatar || '👤'}</span>}
          <h1 className="font-semibold text-text truncate">{character?.name || thread.title}</h1>
          <span className="text-xs text-tertiary bg-surface-secondary px-2 py-0.5 rounded">
            {t('characterTag')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openModal('personaEditor')}
            className="min-h-[44px] px-3 text-sm text-secondary hover:text-text"
          >
            {t('editPersona')}
          </button>
          <button
            onClick={handleDelete}
            className="min-h-[44px] px-3 text-sm text-error hover:opacity-80"
          >
            {t('deleteThread')}
          </button>
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

      <form onSubmit={handleSend} className="border-t border-border p-4">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('inputPlaceholder')}
            className="flex-1 min-h-[44px] px-4 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="min-h-[44px] px-6 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm disabled:opacity-50"
          >
            {t('send')}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ChatView
