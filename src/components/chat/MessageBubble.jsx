import { useState, useRef, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { showToast } from '../../lib/toast'
import { Trash2, Edit3, Copy, GitBranch, RefreshCw, Play, Terminal } from '../../lib/icons'
import Avatar from '../shared/Avatar'

const AVATAR_SIZE_MAP = { '1x': 'sm', '2x': 'md', '3x': 'lg', '4x': 'xl' }

function estimateTokens(text) {
  return Math.ceil((text || '').length / 4)
}

function formatTokenCount(count) {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return String(count)
}

function MessageBubble({
  message,
  messageNumber,
  avatarSrc,
  avatarScale,
  role,
  personaMap,
  streaming,
  onDeleteRequest,
  onEdit,
  onFork,
  onRegenerate,
  onSpeak,
  onShowPrompt,
}) {
  const { t } = useTranslation('chat')
  const { openModal } = useModal()
  const [editing, setEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const editRef = useRef(null)

  const isUser = role === 'user'
  const isSystem = role === 'system'
  const isAssistantOrSystem = role === 'assistant' || role === 'system'
  const avatarSize = AVATAR_SIZE_MAP[avatarScale] || 'sm'
  const tokenCount = estimateTokens(message.content)
  const persona = personaMap?.[message.personaId]
  const personaColor = persona?.color
  const isOOC = message.isOOC

  let userBgClass = 'bg-primary'
  let userBgStyle = null
  if (isOOC) {
    userBgClass = 'bg-red-500'
  } else if (personaColor) {
    userBgStyle = { backgroundColor: personaColor }
    userBgClass = ''
  }

  function handleAvatarClick() {
    if (avatarSrc) openModal('imageViewer', { src: avatarSrc, modalSize: 'fullscreen' })
  }

  function handleCopy() {
    navigator.clipboard
      .writeText(message.content)
      .then(() => showToast(t('messageCopied'), { type: 'success' }))
      .catch(() => {})
  }

  function handleStartEdit() {
    setEditedContent(message.content)
    setEditing(true)
  }

  function handleSaveEdit() {
    const trimmed = editedContent.trim()
    if (trimmed && trimmed !== message.content) {
      onEdit?.(message.id, trimmed)
    }
    setEditing(false)
  }

  function handleCancelEdit() {
    setEditing(false)
  }

  function handleEditKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit()
    }
    if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      style={{ contentVisibility: 'auto' }}
    >
      <div
        className={`max-w-[80%] md:max-w-[65%] rounded-lg ${
          isUser
            ? `${userBgClass} text-on-primary`
            : isSystem
              ? 'bg-surface-secondary text-secondary text-sm italic'
              : 'bg-surface-secondary text-text'
        }`}
        style={isUser ? userBgStyle : undefined}
      >
        {/* Header */}
        <div className="flex items-center gap-1 px-3 pt-2 pb-1.5 border-b border-border-light">
          <Avatar
            src={avatarSrc}
            size={avatarSize}
            className="flex-shrink-0"
            onClick={handleAvatarClick}
          />
          <span className="text-xs font-medium text-tertiary">{`#${messageNumber}`}</span>
          <div className="flex-1 min-w-0" />
          <button
            type="button"
            onClick={() => onDeleteRequest?.(message.id)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-black/10 text-tertiary hover:text-text flex-shrink-0"
            title={t('delete')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleStartEdit}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-black/10 text-tertiary hover:text-text flex-shrink-0"
            title={t('edit')}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-black/10 text-tertiary hover:text-text flex-shrink-0"
            title={t('copy')}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onFork?.(message.id)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-black/10 text-tertiary hover:text-text flex-shrink-0"
            title={t('fork')}
          >
            <GitBranch className="w-3.5 h-3.5" />
          </button>
          {isAssistantOrSystem && (
            <>
              <button
                type="button"
                onClick={() => onRegenerate?.(message.id)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-black/10 text-tertiary hover:text-text flex-shrink-0"
                title={t('regenerate')}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onSpeak?.(message.id)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-black/10 text-tertiary hover:text-text flex-shrink-0"
                title={t('speak')}
              >
                <Play className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onShowPrompt?.()}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-black/10 text-tertiary hover:text-text flex-shrink-0"
                title={t('showPrompt')}
              >
                <Terminal className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Content */}
        <div onDoubleClick={handleStartEdit} className="px-3 py-2">
          {editing ? (
            <textarea
              ref={editRef}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleEditKeyDown}
              autoFocus
              className={`w-full resize-none rounded border p-2 text-sm min-h-[60px] focus:outline-none focus:ring-1 ${
                isUser
                  ? `${userBgClass || 'bg-transparent'} text-on-primary border-white/20 focus:ring-white/40`
                  : 'bg-surface text-text border-border focus:ring-primary/40'
              }`}
              style={isUser ? userBgStyle : undefined}
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {message.content}
              {streaming && (
                <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse align-text-bottom" />
              )}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 pb-2">
          <span className="text-xs opacity-60">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span className="text-xs opacity-60">
            {t('tokens', { count: formatTokenCount(tokenCount) })}
          </span>
        </div>
      </div>
    </div>
  )
}

export default memo(MessageBubble)
