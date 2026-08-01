import { useState, useRef, useEffect, useMemo, memo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSwipe } from '../../hooks/useSwipe'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useOverflowButtons } from '../../hooks/useOverflowButtons'
import { useChatSettings } from '../../hooks/useChatSettings'
import { showToast } from '../../lib/toast'
import { isViewableImage } from '../../lib/image'
import { replaceVars, stripOOCDelimiters } from '../../services/chatApi'
import { stripStatusBlockCodeFences } from '../../services/statusBlocks'
import { getStreamingStartTime } from '../../services/generatingState'
import { injectRuleTags, applyRulesToPlainText } from '../../lib/postProcessing'
import {
  Trash2,
  Edit3,
  Copy,
  FileText,
  GitBranch,
  RefreshCw,
  Play,
  Square,
  Loader,
  Terminal,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Layers,
  ChevronsDown,
  Theater,
  Zap,
  Eye,
  EyeOff,
  Check,
} from '../../lib/icons'
import Avatar from '../shared/Avatar'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import { CodeBlocksMarkdown, CodeBlockWrapper } from './CodeBlockWrapper'
import { speak, stop, subscribe, getPlaybackState } from '../../lib/ttsPlayback'

const DEFAULT_ASSISTANT_ORDER = [
  'delete',
  'deleteAll',
  'deleteFromHere',
  'edit',
  'copy',
  'fork',
  'regenerate',
  'speak',
  'prompt',
  'requestDetails',
  'directorDetails',
  'visible',
]
const DEFAULT_USER_ORDER = [
  'delete',
  'deleteAll',
  'deleteFromHere',
  'edit',
  'copy',
  'fork',
  'makeShortcut',
  'visible',
]

const BUTTON_DEFS = {
  delete: { icon: Trash2, placement: 'header', labelKey: 'delete' },
  deleteAll: { icon: DeleteAllIcon, placement: 'header', labelKey: 'deleteAll' },
  deleteFromHere: { icon: DeleteFromHereIcon, placement: 'header', labelKey: 'deleteFromHere' },
  edit: { icon: Edit3, placement: 'header', labelKey: 'edit' },
  copy: { icon: Copy, placement: 'header', labelKey: 'copy' },
  fork: { icon: GitBranch, placement: 'header', labelKey: 'fork' },
  makeShortcut: { icon: Zap, placement: 'header', labelKey: 'makeShortcut' },
  regenerate: { icon: RefreshCw, placement: 'overflow', labelKey: 'regenerate' },
  speak: { icon: Play, placement: 'overflow', labelKey: 'speak' },
  prompt: { icon: Terminal, placement: 'overflow', labelKey: 'showPrompt' },
  requestDetails: { icon: FileText, placement: 'header', labelKey: 'requestDetails' },
  directorDetails: { icon: Theater, placement: 'header', labelKey: 'directorDetails' },
  visible: { icon: Eye, placement: 'header', labelKey: 'visible', toggle: true },
}

function DeleteAllIcon({ className = '' }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <Trash2 className="w-3.5 h-3.5" />
      <Layers className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-[2px] bg-surface" />
    </span>
  )
}

function DeleteFromHereIcon({ className = '' }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <Trash2 className="w-3.5 h-3.5" />
      <ChevronsDown className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-[2px] bg-surface" />
    </span>
  )
}

const VIS_KEY = {
  user: {
    delete: 'showUserDelete',
    deleteAll: 'showUserDeleteAll',
    deleteFromHere: 'showUserDeleteFromHere',
    edit: 'showUserEdit',
    copy: 'showUserCopy',
    fork: 'showUserFork',
    makeShortcut: 'showUserMakeShortcut',
    visible: 'showUserVisible',
  },
  assistant: {
    delete: 'showAssistantDelete',
    deleteAll: 'showAssistantDeleteAll',
    deleteFromHere: 'showAssistantDeleteFromHere',
    edit: 'showAssistantEdit',
    copy: 'showAssistantCopy',
    fork: 'showAssistantFork',
    regenerate: 'showAssistantRegenerate',
    speak: 'showAssistantSpeak',
    prompt: 'showAssistantPrompt',
    requestDetails: 'showAssistantRequestDetails',
    directorDetails: 'showAssistantDirectorDetails',
    visible: 'showAssistantVisible',
  },
}

const AVATAR_SIZE_MAP = { '1x': 'sm', '2x': 'md', '3x': 'lg', '4x': '2xl' }

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

const BUBBLE_SIZES = {
  compact: 'max-w-[70%] md:max-w-[50%]',
  normal: 'max-w-[80%] md:max-w-[65%]',
  wide: 'max-w-[90%] md:max-w-[80%]',
  full: 'w-full max-w-full',
}

function estimateTokens(text) {
  return Math.ceil((text || '').length / 4)
}

function formatDuration(ms) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms}ms`
}

function countWords(text) {
  const trimmed = (text || '').trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
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
  streamingSlotIndex,
  streamingContent,
  currentOrigin,
  onBundleNavigate,
  onDeleteRequest,
  onEdit,
  onFork,
  onRegenerate,
  onDeleteAllSlots,
  onDeleteFromHere,
  generating,
  requestFailed,
  errorText,
  isUnread,
  slotCreatedAt,
  apiDurationMs,
  character,
  collapsedCodeBlocks,
  onToggleCodeBlock,
  onToggleVisible,
  personaName,
  currentPersonaName,
  statusBlock,
  statusBlockCollapsed,
  onEditStatusBlock,
  onToggleStatusBlockCollapse,
  onRegenerateStatusBlock,
  statusBlockRegenerating,
}) {
  function renderContent(text) {
    let content = text
    if (currentOrigin === 'initial') {
      content = replaceVars(content, {
        charName: character?.name,
        personaName,
        currentPersonaName: personaName,
      })
    }
    if (message.isOOC && oocDelimiters?.enabled) {
      content = stripOOCDelimiters(content, oocDelimiters)
    }
    return content
  }
  const { t } = useTranslation('chat')
  const { openModal } = useModal()
  const [editing, setEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const editRef = useRef(null)
  const [editWidth, setEditWidth] = useState(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const overflowRef = useRef(null)
  const overflowBtnRef = useRef(null)
  const overflowPanelRef = useRef(null)
  const bubbleRef = useRef(null)
  const [overflowMenuStyle, setOverflowMenuStyle] = useState(null)
  const chatSettings = useChatSettings()
  const {
    visibility,
    chatFontFamily,
    chatFontSize,
    messageBubbleSize,
    renderMarkdown,
    order,
    postProcessingEnabled,
    globalPPRules,
    oocDelimiters,
  } = chatSettings || {}
  const [elapsedMs, setElapsedMs] = useState(null)
  const [playbackState, setPlaybackState] = useState(getPlaybackState)

  useEffect(() => {
    if (!streaming) return
    const startTime = getStreamingStartTime(message.id)
    if (!startTime) return
    let cancelled = false
    const tick = () => {
      if (!cancelled) setElapsedMs(Date.now() - startTime)
    }
    const id = setTimeout(tick, 0)
    const interval = setInterval(tick, 1000)
    return () => {
      cancelled = true
      clearTimeout(id)
      clearInterval(interval)
    }
  }, [streaming, message.id])

  useEffect(() => {
    return subscribe(setPlaybackState)
  }, [])

  const activeRules = useMemo(() => {
    const charEnabled = character ? character.postProcessing !== false : undefined
    const enabled = charEnabled !== undefined ? charEnabled : postProcessingEnabled !== false
    if (!enabled) return []
    if (character && character.postProcessingOverride) {
      return character.postProcessingRules || []
    }
    return globalPPRules
  }, [postProcessingEnabled, character, globalPPRules])

  const isUser = role === 'user'
  const isSystem = role === 'system'
  const isSpeakingThis = playbackState.speakingMessageId === message.id
  const isSpeakingLoading = isSpeakingThis && playbackState.phase === 'loading'
  const isSpeakingPlaying = isSpeakingThis && playbackState.phase === 'playing'
  const displayContent = renderContent(
    streaming && streamingContent != null ? streamingContent : message.content,
  )

  const displayContentForRender = useMemo(() => {
    if (renderMarkdown && activeRules.length) return injectRuleTags(displayContent, activeRules)
    return displayContent
  }, [displayContent, renderMarkdown, activeRules])

  const plainSegments = useMemo(() => {
    if (!renderMarkdown && activeRules.length)
      return applyRulesToPlainText(displayContent, activeRules)
    return null
  }, [displayContent, renderMarkdown, activeRules])

  const isMobile = useIsMobile()
  const hasMultipleSlots = bundleMessages?.length > 1
  const bubbleBusy = streaming || statusBlockRegenerating
  useSwipe(bubbleRef, {
    onSwipeLeft: () => {
      if (!hasMultipleSlots) return
      const newIdx = (bundleIndex + 1) % bundleMessages.length
      onBundleNavigate?.(message.id, newIdx)
    },
    onSwipeRight: () => {
      if (!hasMultipleSlots) return
      const newIdx = (bundleIndex - 1 + bundleMessages.length) % bundleMessages.length
      onBundleNavigate?.(message.id, newIdx)
    },
    enabled: isMobile && hasMultipleSlots && !bubbleBusy,
    threshold: 50,
  })

  const contentSlotCount = bundleMessages
    ? bundleMessages.filter((c) => (c?.content || '').trim()).length
    : 1

  const activeEntry = bundleMessages?.[bundleIndex ?? 0] ?? bundleMessages?.[0]
  const isSlotHidden = activeEntry?.hidden === true
  const isSlotError = activeEntry?.isError === true
  const isSlotCancelled = activeEntry?.isCancelled === true

  const statusBlockDisplay = replaceVars(statusBlock, {
    charName: character?.name,
    personaName,
    currentPersonaName: currentPersonaName || personaName,
  })

  const statusBlockRender =
    character?.removeCodeBlocksFromStatusBlock === false
      ? statusBlockDisplay
      : stripStatusBlockCodeFences(statusBlockDisplay)

  const statusBlockVisible =
    !isUser &&
    !isSystem &&
    !message.isOOC &&
    !editing &&
    !requestFailed &&
    (statusBlockDisplay || '').trim().length > 0

  const statusBlockDirectorActive =
    !message.isOOC &&
    !!character?.directorEnabled &&
    !!character?.directorRegularChatStatusBlockEnabled &&
    !!character?.directorRegularChatStatusBlockSystemInstructions?.trim() &&
    !!character?.directorRegularChatStatusBlockInstructions?.trim() &&
    (statusBlockDisplay || '').trim().length > 0

  const statusBlockDirectorFailed = activeEntry?.statusBlockDirectorFailed === true

  function isButtonDisabled(key) {
    if (bubbleBusy) return true
    if (key === 'visible' && isSlotError) return true
    if (requestFailed) return !['delete', 'regenerate', 'deleteAll', 'deleteFromHere'].includes(key)
    if (key === 'deleteAll' && contentSlotCount <= 1) return true
    if (key === 'regenerate' && generating) return true
    if (key === 'requestDetails' && (!slotPromptData || streaming || generating)) return true
    if (key === 'directorDetails' && (!slotPromptData?.directorAttempted || streaming)) return true
    if (!message.content?.trim() && ['edit', 'copy', 'fork', 'speak', 'makeShortcut'].includes(key))
      return true
    return false
  }
  const unreadClass = isUnread ? 'ring-1 ring-primary/40' : ''

  const avatarSize = AVATAR_SIZE_MAP[avatarScale] || 'sm'
  const tokenCount = estimateTokens(displayContent)
  const wordCount = countWords(displayContent)
  const persona = personaMap?.[message.personaId]
  const personaColor = persona?.color
  const isOOC = message.isOOC

  let userMutedClass = 'text-tertiary'
  let userMutedStyle = undefined
  let userHoverBg = 'hover:bg-white/10'
  if (isUser && !isOOC) {
    if (personaColor) {
      userMutedClass = 'text-secondary'
      userHoverBg = 'hover:bg-white/10'
    } else {
      userMutedClass = 'text-on-primary-muted'
      userHoverBg = 'hover:bg-white/10'
    }
  } else if (isUser && isOOC) {
    userMutedClass = 'text-ooc-muted'
    userHoverBg = 'hover:bg-white/10'
  }

  let promptData = null
  try {
    promptData = message.promptData ? JSON.parse(message.promptData) : null
  } catch {
    promptData = null
  }

  let slotPromptData = null
  try {
    slotPromptData = activeEntry?.promptData ? JSON.parse(activeEntry.promptData) : null
  } catch {
    slotPromptData = null
  }

  const directorReviewed = promptData?.directorReviewed || false

  let userBgClass = 'bg-primary text-on-primary'
  let userBgStyle = null
  if (isOOC) {
    userBgClass = 'bg-ooc-subtle text-text border border-border'
    userBgStyle = {
      borderLeftColor: 'var(--color-ooc)',
      borderLeftWidth: '3px',
    }
  } else if (personaColor) {
    userBgStyle = {
      borderLeftColor: personaColor,
      borderLeftWidth: '3px',
      backgroundColor: `color-mix(in srgb, ${personaColor} 12%, var(--color-surface))`,
    }
    userBgClass = 'text-text border border-border'
  }

  function handleAvatarClick() {
    if (isViewableImage(avatarSrc))
      openModal('imageViewer', { src: avatarSrc, modalSize: 'fullscreen' })
  }

  function handleCopy() {
    navigator.clipboard
      .writeText(displayContent)
      .then(() => showToast(t('messageCopied'), { type: 'success' }))
      .catch(() => {})
  }

  function handleStartEdit() {
    setEditWidth(bubbleRef.current?.getBoundingClientRect().width ?? null)
    setEditedContent(message.content)
    setEditing(true)
  }

  function handleSaveEdit() {
    if (editedContent !== message.content) {
      if (!editedContent?.trim()) {
        setEditing(false)
        setEditWidth(null)
        onDeleteRequest?.(message.id)
        return
      }
      onEdit?.(message.id, editedContent)
    }
    setEditing(false)
    setEditWidth(null)
  }

  function handleCancelEdit() {
    setEditing(false)
    setEditWidth(null)
  }

  const [editingStatusBlock, setEditingStatusBlock] = useState(false)
  const [statusBlockDraft, setStatusBlockDraft] = useState('')
  const statusBlockEditRef = useRef(null)

  function handleStartStatusBlockEdit(e) {
    e?.stopPropagation()
    if (bubbleBusy || editing) return
    setStatusBlockDraft(statusBlockDisplay)
    setEditingStatusBlock(true)
  }

  function handleSaveStatusBlockEdit() {
    const next = statusBlockDraft ?? ''
    if (next !== statusBlockDisplay && onEditStatusBlock) {
      onEditStatusBlock(message.id, bundleIndex ?? 0, next)
    }
    setEditingStatusBlock(false)
  }

  function handleCancelStatusBlockEdit() {
    setEditingStatusBlock(false)
  }

  function handleStatusBlockEditKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSaveStatusBlockEdit()
    }
    if (e.key === 'Escape') {
      handleCancelStatusBlockEdit()
    }
  }

  function handleRegenerateStatusBlock() {
    onRegenerateStatusBlock?.(message.id, bundleIndex ?? 0)
  }

  useEffect(() => {
    if (editing && editRef.current) {
      const ta = editRef.current
      ta.focus({ preventScroll: true })
      const len = ta.value.length
      ta.setSelectionRange(len, len)
    }
  }, [editing])

  useEffect(() => {
    if (editingStatusBlock && statusBlockEditRef.current) {
      const ta = statusBlockEditRef.current
      ta.focus({ preventScroll: true })
      const len = ta.value.length
      ta.setSelectionRange(len, len)
    }
  }, [editingStatusBlock])

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
    if (!slotPromptData) return
    openModal('showPrompt', {
      payload: slotPromptData.payload,
      model: slotPromptData.model,
      params: slotPromptData.params,
      msgNumbers: slotPromptData.msgNumbers || null,
      messageFlags: slotPromptData.messageFlags || null,
      directorReviewed: slotPromptData.directorReviewed || false,
      loreActivated: slotPromptData.loreActivated || null,
      lorebooks: slotPromptData.lorebooks || null,
    })
  }

  function handleShowRequestDetails() {
    if (!slotPromptData) return
    openModal('requestDetails', {
      payload: slotPromptData.payload,
      responseData: message.responseData,
      responseContent: message.content,
    })
  }

  function handleShowDirectorDetails() {
    if (!slotPromptData?.directorAttempted) return
    openModal('directorDetails', {
      originalMessage: slotPromptData.directorOriginalMessage || '',
      systemPrompt: slotPromptData.directorSystemPrompt || '',
      userPrompt: slotPromptData.directorUserPrompt || '',
      response: slotPromptData.directorResponse || '',
      failed: slotPromptData.directorFailed || false,
      messageId: message.id,
      threadId: message.threadId,
      outputDirectorResponse: character?.directorRegularChatOutputDirectorResponse !== false,
    })
  }

  useEffect(() => {
    if (!overflowOpen) return
    function handleClick(e) {
      if (
        overflowRef.current &&
        !overflowRef.current.contains(e.target) &&
        overflowPanelRef.current &&
        !overflowPanelRef.current.contains(e.target)
      ) {
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

  useEffect(() => {
    if (!overflowOpen) return
    function handleScroll() {
      setOverflowOpen(false)
      setOverflowMenuStyle(null)
    }
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', handleScroll, { capture: true })
  }, [overflowOpen])

  function handleOverflowClick() {
    if (overflowBtnRef.current) {
      const rect = overflowBtnRef.current.getBoundingClientRect()
      const menuMinWidth = 160
      setOverflowMenuStyle({
        position: 'fixed',
        top: rect.top - 4,
        right: Math.min(window.innerWidth - rect.right, window.innerWidth - menuMinWidth - 4),
        zIndex: 9999,
      })
    }
    setOverflowOpen((prev) => !prev)
  }

  function getButtonHandler(btnKey) {
    switch (btnKey) {
      case 'delete':
        return () => onDeleteRequest?.(message.id)
      case 'deleteAll':
        return () => onDeleteAllSlots?.(message.id)
      case 'deleteFromHere':
        return () => onDeleteFromHere?.(message.id)
      case 'edit':
        return handleStartEdit
      case 'copy':
        return handleCopy
      case 'fork':
        return () => onFork?.(message.id)
      case 'makeShortcut':
        return () => openModal('makeShortcut', { content: message.content })
      case 'regenerate':
        return () => onRegenerate?.(message.id)
      case 'speak':
        return () => {
          if (isSpeakingThis) {
            stop()
          } else {
            speak(message.id, message, {
              character,
              oocDelimiters,
            })
          }
        }
      case 'prompt':
        return handleShowPrompt
      case 'requestDetails':
        return handleShowRequestDetails
      case 'directorDetails':
        return handleShowDirectorDetails
      case 'visible':
        return () => onToggleVisible?.(message.id, bundleIndex ?? 0, !isSlotHidden)
      default:
        return () => {}
    }
  }

  const buttonOrder = isUser
    ? order.userButtonOrder || DEFAULT_USER_ORDER
    : order.assistantButtonOrder || DEFAULT_ASSISTANT_ORDER

  const visMap = isUser ? VIS_KEY.user : VIS_KEY.assistant

  const allButtonKeys = useMemo(() => {
    const canonical = isUser ? DEFAULT_USER_ORDER : DEFAULT_ASSISTANT_ORDER
    const keys = []
    for (const key of buttonOrder) {
      const def = BUTTON_DEFS[key]
      if (!def) continue
      if (!visibility[visMap[key]]) continue
      keys.push(key)
    }
    // Append any known keys missing from a stored order (e.g. newly added
    // buttons), so they remain available without requiring a settings reset.
    for (const key of canonical) {
      if (keys.includes(key)) continue
      if (!BUTTON_DEFS[key]) continue
      if (!visibility[visMap[key]]) continue
      keys.push(key)
    }
    return keys
  }, [buttonOrder, visibility, visMap, isUser])

  const { headerBtnRef, headerKeys, overflowKeys } = useOverflowButtons(allButtonKeys)

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} overflow-hidden`}>
      <div
        ref={bubbleRef}
        className={`${BUBBLE_SIZES[messageBubbleSize] || BUBBLE_SIZES.normal} rounded-lg ${unreadClass} ${
          isUser
            ? userBgClass
            : isOOC
              ? 'bg-ooc-subtle text-text border border-border'
              : isSystem
                ? 'bg-surface-secondary text-secondary text-sm italic'
                : 'bg-surface-secondary text-text'
        } ${isSlotHidden ? 'border-dotted opacity-60' : ''}`}
        style={{
          willChange: isMobile && hasMultipleSlots ? 'transform' : undefined,
          ...(isUser ? userBgStyle : {}),
          ...(!isUser && isOOC
            ? { borderLeftColor: 'var(--color-ooc)', borderLeftWidth: '3px' }
            : {}),
          ...(isSlotHidden && !isUser && !isOOC ? { borderStyle: 'dotted' } : {}),
          ...(editing && editWidth ? { minWidth: editWidth } : {}),
          ...(isSlotHidden && !isUser && !isOOC ? { borderStyle: 'dotted' } : {}),
        }}
      >
        {/* Header */}
        {(() => {
          const hasBundleNav = bundleMessages && bundleMessages.length > 1
          return (
            <div
              className={`px-3 pt-2 pb-1.5 border-b border-border-light ${
                hasBundleNav
                  ? 'flex flex-col md:flex-row md:items-center gap-1'
                  : 'flex items-center gap-1'
              }`}
            >
              <div
                className={`flex items-center gap-1 min-w-0 ${hasBundleNav ? 'w-full md:w-auto' : ''}`}
              >
                <Avatar
                  src={avatarSrc}
                  size={avatarSize}
                  className="flex-shrink-0"
                  onClick={handleAvatarClick}
                />
                {nameLabel && (
                  <span
                    className={`text-xs font-medium truncate min-w-0 ${
                      isUser
                        ? userMutedClass || 'text-on-primary-muted'
                        : isOOC
                          ? 'text-ooc'
                          : 'text-text'
                    }`}
                    style={isUser ? userMutedStyle : undefined}
                  >
                    {nameLabel}
                  </span>
                )}
                {isOOC && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-ooc-subtle text-ooc border border-ooc/30 leading-none shrink-0">
                    {t('oocLabel')}
                  </span>
                )}
              </div>
              <div
                className={`flex items-center gap-1 ${hasBundleNav ? 'w-full md:flex-1 md:min-w-0' : 'flex-1 min-w-0'}`}
              >
                {bundleMessages && bundleMessages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const newIdx =
                          (bundleIndex - 1 + bundleMessages.length) % bundleMessages.length
                        onBundleNavigate?.(message.id, newIdx)
                      }}
                      disabled={bubbleBusy}
                      className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded flex-shrink-0 ${
                        isUser
                          ? `${userHoverBg} ${userMutedClass}`
                          : isOOC
                            ? 'hover:bg-black/10 text-ooc-muted hover:text-ooc'
                            : 'hover:bg-black/10 text-tertiary hover:text-text'
                      } ${bubbleBusy ? 'opacity-30 pointer-events-none cursor-not-allowed' : ''} ${isSlotHidden ? 'opacity-100' : ''}`}
                      style={isUser ? userMutedStyle : undefined}
                      title={t('previousInitialMessage')}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span
                      className={`text-xs whitespace-nowrap ${isUser ? userMutedClass || '' : isOOC ? 'text-ooc-muted' : 'text-tertiary'}`}
                      style={isUser ? userMutedStyle : undefined}
                    >
                      {bundleIndex + 1}/{bundleMessages.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newIdx = (bundleIndex + 1) % bundleMessages.length
                        onBundleNavigate?.(message.id, newIdx)
                      }}
                      disabled={bubbleBusy}
                      className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded flex-shrink-0 ${
                        isUser
                          ? `${userHoverBg} ${userMutedClass}`
                          : isOOC
                            ? 'hover:bg-black/10 text-ooc-muted hover:text-ooc'
                            : 'hover:bg-black/10 text-tertiary hover:text-text'
                      } ${bubbleBusy ? 'opacity-30 pointer-events-none cursor-not-allowed' : ''} ${isSlotHidden ? 'opacity-100' : ''}`}
                      style={isUser ? userMutedStyle : undefined}
                      title={t('nextInitialMessage')}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <div
                  ref={headerBtnRef}
                  className="flex flex-1 min-w-0 items-center justify-end gap-1 overflow-hidden"
                >
                  {headerKeys.map((key) => {
                    const def = BUTTON_DEFS[key]
                    if (!def) return null
                    const Icon = def.icon
                    const isDelete =
                      key === 'delete' || key === 'deleteAll' || key === 'deleteFromHere'
                    const disabled = isButtonDisabled(key)
                    const isToggled = key === 'visible' && !isSlotHidden
                    const baseColor = isUser
                      ? userMutedClass
                        ? `${userHoverBg} ${userMutedClass}`
                        : userHoverBg
                      : isOOC
                        ? 'hover:bg-black/10 text-ooc-muted hover:text-ooc'
                        : 'hover:bg-black/10 text-tertiary hover:text-text'
                    const toggleColor = isToggled ? 'text-primary' : ''
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={getButtonHandler(key)}
                        disabled={disabled}
                        className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded flex-shrink-0 ${baseColor} ${toggleColor} ${
                          disabled ? 'opacity-30 pointer-events-none' : ''
                        } ${isSlotHidden ? 'opacity-100' : ''}`}
                        style={isUser && !isDelete && userMutedStyle ? userMutedStyle : undefined}
                        title={t(def.labelKey)}
                      >
                        {key === 'visible' ? (
                          isToggled ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )
                        ) : key === 'speak' && isSpeakingLoading ? (
                          <Loader className="w-3.5 h-3.5 animate-spin" />
                        ) : key === 'speak' && isSpeakingPlaying ? (
                          <Square className="w-3.5 h-3.5" />
                        ) : (
                          <Icon className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )
                  })}
                  {overflowKeys.length > 0 && (
                    <div ref={overflowRef} className="relative flex-shrink-0">
                      <button
                        ref={overflowBtnRef}
                        type="button"
                        onClick={handleOverflowClick}
                        className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded ${
                          isUser
                            ? userMutedClass
                              ? `${userHoverBg} ${userMutedClass}`
                              : userHoverBg
                            : isOOC
                              ? 'hover:bg-black/10 text-ooc-muted hover:text-ooc'
                              : 'hover:bg-black/10 text-tertiary hover:text-text'
                        } ${isSlotHidden ? 'opacity-100' : ''}`}
                        style={isUser && userMutedStyle ? userMutedStyle : undefined}
                        title={t('moreOptions')}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {overflowOpen &&
                        createPortal(
                          <div
                            ref={overflowPanelRef}
                            style={overflowMenuStyle}
                            className="bg-glass border-glass rounded-lg shadow-surface-lg py-1 min-w-[160px]"
                          >
                            {overflowKeys.map((key) => {
                              const def = BUTTON_DEFS[key]
                              if (!def) return null
                              const Icon = def.icon
                              const isDelete =
                                key === 'delete' || key === 'deleteAll' || key === 'deleteFromHere'
                              const isToggle = key === 'visible'
                              const isToggled = isToggle && !isSlotHidden
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => {
                                    if (!isToggle && key !== 'speak') {
                                      getButtonHandler(key)()
                                      setOverflowOpen(false)
                                    } else {
                                      getButtonHandler(key)()
                                    }
                                  }}
                                  disabled={
                                    (key === 'prompt' && !slotPromptData) || isButtonDisabled(key)
                                  }
                                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm min-h-[44px] disabled:opacity-30 disabled:pointer-events-none ${
                                    isDelete
                                      ? 'text-error hover:bg-surface-hover'
                                      : 'text-text hover:bg-surface-hover'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    {isToggle ? (
                                      isToggled ? (
                                        <Eye className="w-4 h-4" />
                                      ) : (
                                        <EyeOff className="w-4 h-4" />
                                      )
                                    ) : key === 'speak' && isSpeakingLoading ? (
                                      <Loader className="w-4 h-4 animate-spin" />
                                    ) : key === 'speak' && isSpeakingPlaying ? (
                                      <Square className="w-4 h-4" />
                                    ) : (
                                      <Icon className="w-4 h-4" />
                                    )}
                                    <span>
                                      {key === 'speak' && isSpeakingPlaying
                                        ? t('stop')
                                        : t(def.labelKey)}
                                    </span>
                                  </span>
                                  {isToggle && (
                                    <div
                                      className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                                        isToggled
                                          ? 'bg-primary text-on-primary'
                                          : 'bg-surface-secondary border border-border'
                                      }`}
                                    >
                                      {isToggled && <Check className="w-3 h-3" />}
                                    </div>
                                  )}
                                </button>
                              )
                            })}
                          </div>,
                          document.body,
                        )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Content */}
        <div
          onDoubleClick={
            editing || editingStatusBlock || bubbleBusy || requestFailed || !message.content?.trim()
              ? undefined
              : handleStartEdit
          }
          className={editing ? '' : 'px-3 py-2'}
        >
          {editing ? (
            <AutoResizeTextarea
              ref={editRef}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleEditKeyDown}
              extraHeight={8}
              className={`w-full resize-none rounded border whitespace-pre-wrap break-words px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                isOOC
                  ? 'bg-ooc-subtle text-text border-border focus:ring-ooc'
                  : isUser
                    ? `${userBgClass || 'bg-transparent'} border-white/20 focus:ring-white/40`
                    : 'bg-surface text-text border-border focus:ring-primary/40'
              }`}
              style={{
                ...(isOOC
                  ? { borderLeftColor: 'var(--color-ooc)', borderLeftWidth: '3px' }
                  : isUser
                    ? userBgStyle
                    : undefined),
                fontFamily: CHAT_FONTS[chatFontFamily],
                fontSize: CHAT_FONT_SIZES[chatFontSize],
              }}
            />
          ) : requestFailed ? (
            <div className="bg-error-subtle rounded p-3 text-sm max-w-full overflow-hidden">
              <p className="font-bold text-error">
                {isSlotCancelled ? t('cancelled') + ':' : 'Error:'}
              </p>
              <pre className="mt-1 text-error text-xs overflow-x-auto max-w-full whitespace-pre-wrap break-words">
                {errorText || '(No content)'}
              </pre>
            </div>
          ) : (
            <div
              className="text-sm markdown-body w-full overflow-hidden"
              style={{
                fontFamily: CHAT_FONTS[chatFontFamily],
                fontSize: CHAT_FONT_SIZES[chatFontSize],
              }}
            >
              {renderMarkdown ? (
                <CodeBlocksMarkdown
                  content={displayContentForRender}
                  activeRules={activeRules}
                  collapsedCodeBlocks={collapsedCodeBlocks}
                  onToggleCodeBlock={onToggleCodeBlock}
                  messageId={message.id}
                />
              ) : plainSegments ? (
                <p className="mb-2 last:mb-0 whitespace-pre-wrap">
                  {plainSegments.map((seg, idx) =>
                    seg.type === 'styled' ? (
                      <span
                        key={idx}
                        style={{
                          color: activeRules[seg.ruleIndex].color,
                          fontSize: `${activeRules[seg.ruleIndex].fontSizePercent}%`,
                        }}
                      >
                        {seg.content}
                      </span>
                    ) : (
                      <span key={idx}>{seg.content}</span>
                    ),
                  )}
                </p>
              ) : (
                <p className="mb-2 last:mb-0 whitespace-pre-wrap">{displayContent}</p>
              )}
              {streaming && (!hasMultipleSlots || bundleIndex === streamingSlotIndex) && (
                <RefreshCw className="inline-block w-4 h-4 text-primary animate-spin ml-0.5 align-text-bottom" />
              )}
            </div>
          )}

          {(statusBlockVisible || statusBlockRegenerating) &&
            (statusBlockRegenerating ? (
              <div className="mt-2 flex justify-center py-2">
                <Loader className="w-4 h-4 animate-spin text-tertiary" />
              </div>
            ) : editingStatusBlock ? (
              <AutoResizeTextarea
                ref={statusBlockEditRef}
                value={statusBlockDraft}
                onChange={(e) => setStatusBlockDraft(e.target.value)}
                onBlur={handleSaveStatusBlockEdit}
                onKeyDown={handleStatusBlockEditKeyDown}
                extraHeight={8}
                className="mt-2 w-full resize-none rounded border whitespace-pre-wrap break-words px-3 py-2 text-sm focus:outline-none focus:ring-1 bg-surface text-text border-border focus:ring-primary/40"
                style={{
                  fontFamily: CHAT_FONTS[chatFontFamily],
                  fontSize: CHAT_FONT_SIZES[chatFontSize],
                }}
              />
            ) : renderMarkdown ? (
              <div className="mt-2" onDoubleClick={handleStartStatusBlockEdit}>
                <CodeBlockWrapper
                  collapsed={statusBlockCollapsed}
                  onToggle={() => onToggleStatusBlockCollapse?.(message.id, bundleIndex ?? 0)}
                  codeText={statusBlockRender}
                  isStatusBlock
                  onEditStatusBlock={handleStartStatusBlockEdit}
                  statusBlockLabel={t('editStatusBlock')}
                  onRegenerateStatusBlock={
                    statusBlockDirectorActive && !streaming
                      ? handleRegenerateStatusBlock
                      : undefined
                  }
                  regenerateStatusBlockLabel={t('regenerateStatusBlock')}
                  statusBlockDirectorFailed={statusBlockDirectorFailed}
                >
                  <code className="language-status-block">{statusBlockRender}</code>
                </CodeBlockWrapper>
              </div>
            ) : (
              <div
                onDoubleClick={handleStartStatusBlockEdit}
                className="mt-2 rounded-md border border-border bg-code p-3 text-sm whitespace-pre-wrap break-words cursor-text"
              >
                {statusBlockRender}
              </div>
            ))}
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between px-3 pb-2 ${isUser ? userMutedClass || '' : ''}`}
          style={isUser && userMutedStyle ? userMutedStyle : undefined}
        >
          <span className="flex items-center gap-2">
            <span
              className={`text-xs font-medium ${isUser ? '' : isOOC ? 'text-ooc-muted' : 'text-tertiary'}`}
            >{`#${messageNumber}`}</span>
            <span className={`text-xs ${isUser ? '' : 'opacity-60'}`}>
              {new Date(slotCreatedAt || message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </span>
          <span className="flex items-center gap-2">
            {currentOrigin === 'initial' && (
              <span className={`text-xs ${isUser ? '' : 'opacity-60'}`}>{t('initialMessage')}</span>
            )}
            {currentOrigin === 'edit' && (
              <span className={`text-xs ${isUser ? '' : 'opacity-60'}`}>{t('edited')}</span>
            )}
            {directorReviewed && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                DIR
              </span>
            )}
            {streaming && elapsedMs != null && (
              <span className={`text-xs ${isUser ? '' : 'opacity-60'}`}>
                {t('apiDuration', { duration: formatDuration(elapsedMs) })}
              </span>
            )}
            {!streaming && typeof apiDurationMs === 'number' && (
              <span className={`text-xs ${isUser ? '' : 'opacity-60'}`}>
                {t('apiDuration', { duration: formatDuration(apiDurationMs) })}
              </span>
            )}
            {!streaming && !isSlotError && displayContent?.trim() && (
              <span className={`text-xs ${isUser ? '' : 'opacity-60'}`}>
                {t('tokens', { count: tokenCount })}
              </span>
            )}
            {!streaming && !isSlotError && displayContent?.trim() && (
              <span className={`text-xs ${isUser ? '' : 'opacity-60'}`}>
                {t('words', { count: wordCount })}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

export default memo(MessageBubble)
