import { useState, useRef, useEffect, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { showToast } from '../../lib/toast'
import { getSetting } from '../../services/settings'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import {
  Trash2,
  Edit3,
  Copy,
  GitBranch,
  RefreshCw,
  Play,
  Terminal,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from '../../lib/icons'
import Avatar from '../shared/Avatar'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'

const VISIBILITY_KEYS = [
  'showAssistantDelete',
  'showAssistantEdit',
  'showAssistantCopy',
  'showAssistantFork',
  'showAssistantRegenerate',
  'showAssistantSpeak',
  'showAssistantPrompt',
  'showUserDelete',
  'showUserEdit',
  'showUserCopy',
  'showUserFork',
]

const ORDER_KEYS = ['assistantButtonOrder', 'userButtonOrder']
const DEFAULT_ASSISTANT_ORDER = ['delete', 'edit', 'copy', 'fork', 'regenerate', 'speak', 'prompt']
const DEFAULT_USER_ORDER = ['delete', 'edit', 'copy', 'fork']

const BUTTON_DEFS = {
  delete: { icon: Trash2, placement: 'header', labelKey: 'delete' },
  edit: { icon: Edit3, placement: 'header', labelKey: 'edit' },
  copy: { icon: Copy, placement: 'header', labelKey: 'copy' },
  fork: { icon: GitBranch, placement: 'header', labelKey: 'fork' },
  regenerate: { icon: RefreshCw, placement: 'overflow', labelKey: 'regenerate' },
  speak: { icon: Play, placement: 'overflow', labelKey: 'speak' },
  prompt: { icon: Terminal, placement: 'overflow', labelKey: 'showPrompt' },
}

const VIS_KEY = {
  user: {
    delete: 'showUserDelete',
    edit: 'showUserEdit',
    copy: 'showUserCopy',
    fork: 'showUserFork',
  },
  assistant: {
    delete: 'showAssistantDelete',
    edit: 'showAssistantEdit',
    copy: 'showAssistantCopy',
    fork: 'showAssistantFork',
    regenerate: 'showAssistantRegenerate',
    speak: 'showAssistantSpeak',
    prompt: 'showAssistantPrompt',
  },
}

const AVATAR_SIZE_MAP = { '1x': 'sm', '2x': 'md', '3x': 'lg', '4x': 'xl' }

const CHAT_FONTS = {
  system: undefined,
  inter: "'Inter', sans-serif",
  atkinson: "'Atkinson Hyperlegible', sans-serif",
  roboto: "'Roboto', sans-serif",
  georgia: 'Georgia, serif',
  courier: "'Courier New', monospace",
  trebuchet: "'Trebuchet MS', sans-serif",
}

const CHAT_FONT_SIZES = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
}

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
  nameLabel,
  streaming,
  bundleMessages,
  bundleIndex,
  currentOrigin,
  onBundleNavigate,
  onDeleteRequest,
  onEdit,
  onFork,
  onRegenerate,
  onSpeak,
  generating,
  charName,
  personaName,
  isUnread,
  slotCreatedAt,
}) {
  function renderContent(text) {
    if (!text) return text
    return text.replace(/{{char}}/g, charName || '').replace(/{{user}}/g, personaName || '')
  }
  const { t } = useTranslation('chat')
  const { openModal } = useModal()
  const [editing, setEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const editRef = useRef(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowRef = useRef(null)
  const overflowBtnRef = useRef(null)
  const [overflowMenuStyle, setOverflowMenuStyle] = useState(null)
  const [visibility, setVisibility] = useState(
    Object.fromEntries(VISIBILITY_KEYS.map((k) => [k, true])),
  )
  const [chatFontFamily, setChatFontFamily] = useState('system')
  const [chatFontSize, setChatFontSize] = useState('sm')
  const [order, setOrder] = useState({ assistantButtonOrder: null, userButtonOrder: null })

  useEffect(() => {
    async function load() {
      const entries = await Promise.all(VISIBILITY_KEYS.map(async (k) => [k, await getSetting(k)]))
      setVisibility(Object.fromEntries(entries))
    }
    load()
  }, [])

  useEffect(() => {
    async function load() {
      const [assistantOrder, userOrder] = await Promise.all([
        getSetting('assistantButtonOrder'),
        getSetting('userButtonOrder'),
      ])
      setOrder({ assistantButtonOrder: assistantOrder, userButtonOrder: userOrder })
    }
    load()
  }, [])

  useEffect(() => {
    function handler() {
      VISIBILITY_KEYS.forEach(async (k) => {
        const v = await getSetting(k)
        setVisibility((prev) => ({ ...prev, [k]: v }))
      })
    }
    window.addEventListener('settings-changed', handler)
    return () => window.removeEventListener('settings-changed', handler)
  }, [])

  useEffect(() => {
    async function load() {
      const [family, size] = await Promise.all([
        getSetting('chatFontFamily'),
        getSetting('chatFontSize'),
      ])
      setChatFontFamily(family || 'system')
      setChatFontSize(size || 'sm')
    }
    load()
    function handler(e) {
      if (e.detail?.key === 'chatFontFamily') setChatFontFamily(e.detail.value || 'system')
      if (e.detail?.key === 'chatFontSize') setChatFontSize(e.detail.value || 'sm')
      if (ORDER_KEYS.includes(e.detail?.key)) {
        getSetting(e.detail.key).then((v) => setOrder((prev) => ({ ...prev, [e.detail.key]: v })))
      }
    }
    window.addEventListener('settings-changed', handler)
    return () => window.removeEventListener('settings-changed', handler)
  }, [])

  const isUser = role === 'user'
  const isSystem = role === 'system'
  const isAssistantOrSystem = role === 'assistant' || role === 'system'
  const displayContent = renderContent(message.content)
  const unreadClass = isUnread ? 'ring-1 ring-primary/40' : ''

  const avatarSize = AVATAR_SIZE_MAP[avatarScale] || 'sm'
  const tokenCount = estimateTokens(displayContent)
  const persona = personaMap?.[message.personaId]
  const personaColor = persona?.color
  const isOOC = message.isOOC

  let promptData = null
  try {
    promptData = message.promptData ? JSON.parse(message.promptData) : null
  } catch {
    promptData = null
  }

  let userBgClass = 'bg-primary'
  let userBgStyle = null
  if (isOOC) {
    userBgClass = 'bg-red-50 text-red-900 border border-red-200'
  } else if (personaColor) {
    userBgStyle = { backgroundColor: personaColor }
    userBgClass = ''
  }

  function handleAvatarClick() {
    if (avatarSrc) openModal('imageViewer', { src: avatarSrc, modalSize: 'fullscreen' })
  }

  function handleCopy() {
    navigator.clipboard
      .writeText(displayContent)
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

  function handleShowPrompt() {
    if (!promptData) return
    openModal('showPrompt', {
      payload: promptData.payload,
      model: promptData.model,
      params: promptData.params,
    })
  }

  useEffect(() => {
    if (!overflowOpen) return
    function handleClick(e) {
      if (overflowRef.current && !overflowRef.current.contains(e.target)) {
        setOverflowOpen(false)
        setOverflowMenuStyle(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [overflowOpen])

  useEffect(() => {
    if (!overflowOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') {
        setOverflowOpen(false)
        setOverflowMenuStyle(null)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [overflowOpen])

  function handleOverflowClick() {
    if (overflowBtnRef.current) {
      const rect = overflowBtnRef.current.getBoundingClientRect()
      setOverflowMenuStyle({
        position: 'fixed',
        top: rect.top - 4,
        right: window.innerWidth - rect.right,
        zIndex: 9999,
      })
    }
    setOverflowOpen((prev) => !prev)
  }

  function getButtonHandler(btnKey) {
    switch (btnKey) {
      case 'delete':
        return () => onDeleteRequest?.(message.id)
      case 'edit':
        return handleStartEdit
      case 'copy':
        return handleCopy
      case 'fork':
        return () => onFork?.(message.id)
      case 'regenerate':
        return () => onRegenerate?.(message.id)
      case 'speak':
        return () => onSpeak?.(message.id)
      case 'prompt':
        return handleShowPrompt
      default:
        return () => {}
    }
  }

  const buttonOrder = isUser
    ? order.userButtonOrder || DEFAULT_USER_ORDER
    : order.assistantButtonOrder || DEFAULT_ASSISTANT_ORDER

  const visMap = isUser ? VIS_KEY.user : VIS_KEY.assistant

  const headerButtons = []
  const overflowButtons = []
  for (const key of buttonOrder) {
    const def = BUTTON_DEFS[key]
    if (!def) continue
    if (!visibility[visMap[key]]) continue
    if (def.placement === 'header') {
      headerButtons.push(key)
    } else {
      overflowButtons.push(key)
    }
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] md:max-w-[65%] rounded-lg ${unreadClass} ${
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
          {nameLabel && (
            <span className="text-xs font-medium text-text truncate max-w-[100px]">
              {nameLabel}
            </span>
          )}
          {bundleMessages && bundleMessages.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => {
                  const newIdx = (bundleIndex - 1 + bundleMessages.length) % bundleMessages.length
                  onBundleNavigate?.(message.id, newIdx)
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-black/10 text-tertiary hover:text-text flex-shrink-0"
                title={t('previousInitialMessage')}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-tertiary whitespace-nowrap">
                {bundleIndex + 1}/{bundleMessages.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  const newIdx = (bundleIndex + 1) % bundleMessages.length
                  onBundleNavigate?.(message.id, newIdx)
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-black/10 text-tertiary hover:text-text flex-shrink-0"
                title={t('nextInitialMessage')}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <div className="flex-1 min-w-0" />
          {headerButtons.map((key) => {
            const def = BUTTON_DEFS[key]
            if (!def) return null
            const Icon = def.icon
            const isDelete = key === 'delete'
            return (
              <button
                key={key}
                type="button"
                onClick={getButtonHandler(key)}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded flex-shrink-0 ${
                  isDelete
                    ? 'bg-delete text-on-delete hover:bg-delete-hover'
                    : 'hover:bg-black/10 text-tertiary hover:text-text'
                }`}
                title={t(def.labelKey)}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            )
          })}
          {isAssistantOrSystem && overflowButtons.length > 0 && (
            <div ref={overflowRef} className="relative flex-shrink-0">
              <button
                ref={overflowBtnRef}
                type="button"
                onClick={handleOverflowClick}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-black/10 text-tertiary hover:text-text"
                title={t('moreOptions')}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {overflowOpen && (
                <div
                  style={overflowMenuStyle}
                  className="bg-surface border border-border rounded-lg shadow-surface-lg py-1 min-w-[160px]"
                >
                  {overflowButtons.map((key) => {
                    const def = BUTTON_DEFS[key]
                    if (!def) return null
                    const Icon = def.icon
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          getButtonHandler(key)()
                          setOverflowOpen(false)
                        }}
                        disabled={
                          (key === 'prompt' && !promptData) || (key === 'regenerate' && generating)
                        }
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface-hover min-h-[44px] disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <Icon className="w-4 h-4" />
                        <span>{t(def.labelKey)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div onDoubleClick={handleStartEdit} className="px-3 py-2">
          {editing ? (
            <AutoResizeTextarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleEditKeyDown}
              autoFocus
              className={`w-full resize-none rounded border p-2 text-sm focus:outline-none focus:ring-1 ${
                isOOC
                  ? 'bg-red-50 text-red-900 border-red-200 focus:ring-red-300'
                  : isUser
                    ? `${userBgClass || 'bg-transparent'} text-on-primary border-white/20 focus:ring-white/40`
                    : 'bg-surface text-text border-border focus:ring-primary/40'
              }`}
              style={{
                ...(isUser ? userBgStyle : undefined),
                fontFamily: CHAT_FONTS[chatFontFamily],
                fontSize: CHAT_FONT_SIZES[chatFontSize],
              }}
            />
          ) : (
            <div
              className="text-sm"
              style={{
                fontFamily: CHAT_FONTS[chatFontFamily],
                fontSize: CHAT_FONT_SIZES[chatFontSize],
              }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={{
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
                  ),
                }}
              >
                {displayContent}
              </ReactMarkdown>
              {streaming && (
                <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse align-text-bottom" />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 pb-2">
          <span className="flex items-center gap-2">
            <span className="text-xs font-medium text-tertiary">{`#${messageNumber}`}</span>
            <span className="text-xs opacity-60">
              {new Date(slotCreatedAt || message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </span>
          <span className="flex items-center gap-2">
            {currentOrigin === 'initial' && (
              <span className="text-xs opacity-60">{t('initialMessage')}</span>
            )}
            {currentOrigin === 'edit' && <span className="text-xs opacity-60">{t('edited')}</span>}
            <span className="text-xs opacity-60">
              {t('tokens', { count: formatTokenCount(tokenCount) })}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

export default memo(MessageBubble)
