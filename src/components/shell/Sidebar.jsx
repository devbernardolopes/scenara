import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getAllThreads,
  deleteThread,
  deleteThreads,
  toggleFavorite,
  toggleLock,
  updateThreadColor,
  duplicateThread,
} from '../../services/threads'
import { getCharacter, importCharacterFromFile } from '../../services/characters'
import { useModal } from '../../hooks/useModal'
import { useConfirm } from '../../lib/confirm'
import { showToast } from '../../lib/toast'
import { getSetting } from '../../services/settings'
import { findColorSlot, getColorHex } from '../../config/colorPalettes'
import { useTheme } from '../../hooks/useTheme'
import ColorPicker from '../shared/ColorPicker'
import CloseButton from '../shared/CloseButton'
import MarkdownTitle from '../shared/MarkdownTitle'
import {
  UserPlus,
  Settings,
  Edit3,
  Trash2,
  Copy,
  Star,
  Lock,
  Unlock,
  Palette,
  CheckSquare,
  Square,
  FileText,
  Zap,
  BookOpen,
  Tags,
  BrainCog,
  Plus,
  Upload,
  Globe,
  FileUp,
  SlidersHorizontal,
  RefreshCw,
} from '../../lib/icons'
import { getGeneratingThreads } from '../../services/generatingState'
import * as apiQueue from '../../services/apiQueue'
import { useUnread } from '../../hooks/useUnread'
import { getThreadMessageCounts } from '../../services/messages'

function ThreadCardTitle({ title, isActive, threadCardMarquee }) {
  const wrapperRef = useRef(null)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = wrapperRef.current
    if (el && threadCardMarquee) {
      const overflows = el.scrollWidth > el.clientWidth
      if (overflows) {
        el.style.setProperty('--marquee-distance', `-${el.scrollWidth - el.clientWidth}px`)
      }
      setOverflows(overflows)
    } else {
      setOverflows(false)
    }
  }, [title, threadCardMarquee])

  if (!threadCardMarquee) {
    return (
      <span className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-text'}`}>
        <MarkdownTitle>{title}</MarkdownTitle>
      </span>
    )
  }

  return (
    <span
      ref={wrapperRef}
      className={`text-sm font-medium marquee-wrapper ${overflows ? 'marquee-animate' : ''} ${isActive ? 'text-primary' : 'text-text'}`}
    >
      <span className="marquee-text">
        <MarkdownTitle>{title}</MarkdownTitle>
      </span>
    </span>
  )
}

function Sidebar({ open, onClose }) {
  const { t } = useTranslation('common')
  const { threadId } = useParams()
  const navigate = useNavigate()
  const { openModal } = useModal()
  const { confirm } = useConfirm()
  const { theme } = useTheme()
  const [threads, setThreads] = useState([])
  const [characters, setCharacters] = useState({})
  const [colorPickerId, setColorPickerId] = useState(null)
  const [colorPickerPos, setColorPickerPos] = useState(null)
  const colorPickerRef = useRef(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showImportMenu, setShowImportMenu] = useState(false)
  const [generatingSet, setGeneratingSet] = useState(() => getGeneratingThreads())
  const [queueCounts, setQueueCounts] = useState({})
  const [threadCardMarquee, setThreadCardMarquee] = useState(true)
  const [unreadBadges, setUnreadBadges] = useState(true)
  const [sidebarNavLayout, setSidebarNavLayout] = useState('vertical')
  const [messageCounts, setMessageCounts] = useState(new Map())
  const fileInputRef = useRef(null)
  useUnread()

  function handleCreateCharacter() {
    openModal('characterCreate')
  }

  function handleImportUrl() {
    setShowImportMenu(false)
    const url = window.prompt(t('sidebar.importUrlPrompt'))
    if (url) {
      showToast(t('sidebar.importUrlComingSoon'), { type: 'info' })
    }
  }

  function handleImportFile() {
    setShowImportMenu(false)
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await importCharacterFromFile(file)
      openModal('characterCreate', { initialData: data })
    } catch (err) {
      showToast(err.message, { type: 'error' })
    }
    e.target.value = ''
  }

  useEffect(() => {
    if (!colorPickerId) return
    function handleClick(e) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setColorPickerId(null)
        setColorPickerPos(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [colorPickerId])

  const loadData = useCallback(async () => {
    const all = await getAllThreads()
    setThreads(all)
    const ids = [...new Set(all.map((t) => t.characterId).filter(Boolean))]
    const chars = await Promise.all(ids.map((id) => getCharacter(id)))
    const map = {}
    chars.forEach((c) => {
      if (c) map[c.id] = c
    })
    setCharacters(map)
    const counts = await getThreadMessageCounts()
    setMessageCounts(counts)
  }, [])

  useEffect(() => {
    loadData()
    window.addEventListener('threads-changed', loadData)
    window.addEventListener('characters-changed', loadData)
    window.addEventListener('messages-changed', loadData)
    return () => {
      window.removeEventListener('threads-changed', loadData)
      window.removeEventListener('characters-changed', loadData)
      window.removeEventListener('messages-changed', loadData)
    }
  }, [loadData])

  useEffect(() => {
    function handleChange(e) {
      const { threadId, generating } = e.detail
      setGeneratingSet((prev) => {
        const next = new Set(prev)
        if (generating) {
          next.add(threadId)
        } else {
          next.delete(threadId)
        }
        return next
      })
    }
    window.addEventListener('generating-state-changed', handleChange)
    return () => window.removeEventListener('generating-state-changed', handleChange)
  }, [])

  useEffect(() => {
    function updateQueueCounts() {
      const counts = {}
      threads.forEach((t) => {
        const c = apiQueue.getThreadQueuedCount(t.id)
        if (c > 0) counts[t.id] = c
      })
      setQueueCounts(counts)
    }
    updateQueueCounts()
    const unsub = apiQueue.subscribe(updateQueueCounts)
    window.addEventListener('api-queue-changed', updateQueueCounts)
    return () => {
      unsub()
      window.removeEventListener('api-queue-changed', updateQueueCounts)
    }
  }, [threads])

  useEffect(() => {
    getSetting('threadCardMarquee').then((val) => {
      setThreadCardMarquee(val !== false)
    })
    function onSettingsChanged(e) {
      if (e.detail?.key === 'threadCardMarquee') {
        setThreadCardMarquee(e.detail.value !== false)
      }
    }
    window.addEventListener('settings-changed', onSettingsChanged)
    return () => window.removeEventListener('settings-changed', onSettingsChanged)
  }, [])

  useEffect(() => {
    getSetting('unreadBadges').then((val) => {
      setUnreadBadges(val !== false)
    })
    function onSettingsChanged(e) {
      if (e.detail?.key === 'unreadBadges') {
        setUnreadBadges(e.detail.value !== false)
      }
    }
    window.addEventListener('settings-changed', onSettingsChanged)
    return () => window.removeEventListener('settings-changed', onSettingsChanged)
  }, [])

  useEffect(() => {
    getSetting('sidebarNavLayout').then((val) => {
      setSidebarNavLayout(val || 'vertical')
    })
    function onSettingsChanged(e) {
      if (e.detail?.key === 'sidebarNavLayout') {
        setSidebarNavLayout(e.detail.value || 'vertical')
      }
    }
    window.addEventListener('settings-changed', onSettingsChanged)
    return () => window.removeEventListener('settings-changed', onSettingsChanged)
  }, [])

  function handleEditTitle(thread) {
    openModal('editThreadTitle', { thread })
  }

  function handleEditCharacter(thread) {
    const character = characters[thread.characterId]
    if (character) {
      openModal('characterCreate', { character })
    }
  }

  async function handleDelete(thread) {
    if (thread.isLocked) return
    const ok = await confirm({
      title: t('sidebar.confirmDeleteTitle'),
      message: t('sidebar.confirmDeleteMessage'),
      confirmLabel: t('sidebar.deleteThread'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    })
    if (!ok) return
    const wasActive = String(thread.id) === threadId
    await deleteThread(thread.id)
    if (wasActive) navigate('/')
  }

  async function handleDuplicate(thread) {
    const ok = await confirm({
      title: t('sidebar.confirmDuplicateTitle'),
      message: t('sidebar.confirmDuplicateMessage'),
      confirmLabel: t('sidebar.duplicateThread'),
      cancelLabel: t('cancel'),
    })
    if (!ok) return
    const newId = await duplicateThread(thread.id)
    navigate(`/chat/${newId}`)
  }

  async function handleToggleFavorite(thread) {
    await toggleFavorite(thread.id)
  }

  async function handleToggleLock(thread) {
    await toggleLock(thread.id)
    if (!thread.isLocked) {
      setSelectedIds((prev) => {
        if (!prev.has(thread.id)) return prev
        const next = new Set(prev)
        next.delete(thread.id)
        return next
      })
    }
  }

  async function handleColorSelect(thread, color) {
    const colorSlot = color ? findColorSlot(color, theme) : -1
    await updateThreadColor(thread.id, color, colorSlot)
    setColorPickerId(null)
    setColorPickerPos(null)
  }

  function toggleSelect(threadId) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(threadId)) {
        next.delete(threadId)
      } else {
        next.add(threadId)
      }
      return next
    })
  }

  function toggleSelectAll() {
    const selectable = threads.filter((t) => !t.isLocked)
    if (selectedIds.size === selectable.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectable.map((t) => t.id)))
    }
  }

  async function handleBatchDelete() {
    const lockedIds = new Set(threads.filter((t) => t.isLocked).map((t) => t.id))
    const deletableIds = [...selectedIds].filter((id) => !lockedIds.has(id))
    if (deletableIds.length === 0) return
    const ok = await confirm({
      title: t('sidebar.confirmBatchDeleteTitle'),
      message: t('sidebar.confirmBatchDeleteMessage', { count: deletableIds.length }),
      confirmLabel: t('sidebar.deleteSelected'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    })
    if (!ok) return
    const hadActive = deletableIds.some((id) => String(id) === threadId)
    await deleteThreads(deletableIds)
    setSelectedIds(new Set())
    if (hadActive) navigate('/')
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-overlay z-30 md:hidden" onClick={onClose} />}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-80 max-w-[85vw] lg:w-96 bg-surface-secondary border-r border-border
          flex flex-col
          transform transition-transform duration-200 ease-in-out
          md:relative md:transform-none md:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <Link to="/" className="font-bold text-lg text-text hover:text-text" onClick={onClose}>
            {t('appName')}
          </Link>
          <div className="flex items-center gap-1">
            {threads.length > 0 &&
              (() => {
                const selectableCount = threads.filter((t) => !t.isLocked).length
                const selectedCount = selectedIds.size
                const allSelected = selectableCount > 0 && selectedCount === selectableCount
                const someSelected = selectedCount > 0 && !allSelected
                const selectAllLabel = allSelected
                  ? t('sidebar.deselectAll')
                  : t('sidebar.selectAll')
                return (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-tertiary hover:text-text hover:bg-surface-hover"
                    aria-label={selectAllLabel}
                    aria-pressed={allSelected}
                    title={selectAllLabel}
                  >
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : someSelected ? (
                      <div className="w-4 h-4 flex items-center justify-center">
                        <span className="block w-2.5 h-0.5 bg-current rounded-full" />
                      </div>
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                )
              })()}
            <button
              onClick={handleCreateCharacter}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-tertiary hover:text-text hover:bg-surface-hover"
              aria-label={t('sidebar.createCharacter')}
              title={t('sidebar.createCharacter')}
            >
              <Plus className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowImportMenu((v) => !v)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-tertiary hover:text-text hover:bg-surface-hover"
                aria-label={t('sidebar.importCharacter')}
                title={t('sidebar.importCharacter')}
              >
                <Upload className="w-4 h-4" />
              </button>
              {showImportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowImportMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-md shadow-surface-lg z-20 py-1">
                    <button
                      onClick={handleImportUrl}
                      className="flex items-center gap-2 w-full min-h-[44px] px-3 text-sm text-text hover:bg-surface-hover"
                    >
                      <Globe className="w-4 h-4" />
                      {t('sidebar.importFromUrl')}
                    </button>
                    <button
                      onClick={handleImportFile}
                      className="flex items-center gap-2 w-full min-h-[44px] px-3 text-sm text-text hover:bg-surface-hover"
                    >
                      <FileUp className="w-4 h-4" />
                      {t('sidebar.importFromFile')}
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="md:hidden">
              <CloseButton onClick={onClose} label={t('sidebar.close')} />
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {threads.length === 0 ? (
            <p className="text-xs text-tertiary px-3">{t('sidebar.newChat')}</p>
          ) : (
            threads.map((thread) => {
              const character = characters[thread.characterId]
              const isActive = String(thread.id) === threadId
              const threadColor =
                thread.colorSlot >= 0 ? getColorHex(theme, thread.colorSlot) : thread.color
              return (
                <div
                  key={thread.id}
                  className={`rounded-lg border ${isActive ? 'border-primary' : 'border-border'} overflow-hidden border-l-[3px] p-2 flex flex-col w-full aspect-[2.3/1]`}
                  style={{
                    borderLeftColor: threadColor || undefined,
                    backgroundColor: threadColor
                      ? `color-mix(in srgb, ${threadColor} 12%, var(--color-surface))`
                      : undefined,
                  }}
                >
                  <Link
                    to={`/chat/${thread.id}`}
                    onClick={onClose}
                    className="flex items-stretch gap-0 min-w-0 flex-1 min-h-0"
                  >
                    <div className="w-22 flex-shrink-0 self-stretch rounded-l-lg overflow-hidden relative bg-surface-hover">
                      {character?.avatar &&
                      (/^https?:\/\//.test(character.avatar) ||
                        character.avatar.startsWith('data:image/')) ? (
                        <img
                          src={character.avatar}
                          alt={character?.name || ''}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex items-center justify-center h-full w-full text-3xl">
                          {character?.avatar || '👤'}
                        </span>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1 py-0.5">
                        <p className="text-center text-[10px] text-on-image-muted leading-none truncate">
                          #{thread.threadNumber} · {messageCounts.get(thread.id) || 0}
                        </p>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1 pl-2">
                      <div className="flex items-center gap-1">
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <ThreadCardTitle
                            title={thread.title}
                            isActive={isActive}
                            threadCardMarquee={threadCardMarquee}
                          />
                          <div className="flex items-center gap-1.5 shrink-0">
                            {unreadBadges && (thread.unreadCount || 0) > 0 && (
                              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-badge-unread-text bg-badge-unread rounded-full">
                                {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                              </span>
                            )}
                            {generatingSet.has(thread.id) && (
                              <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />
                            )}
                            {queueCounts[thread.id] > 0 && (
                              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-badge-queue-text bg-badge-queue rounded-full">
                                {queueCounts[thread.id]}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="w-[26px] shrink-0 flex justify-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleEditTitle(thread)
                            }}
                            className="w-[26px] h-[26px] flex items-center justify-center rounded text-tertiary hover:text-text hover:bg-surface-hover"
                            aria-label={t('editThreadTitle.title')}
                            title={t('editThreadTitle.title')}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <p className="text-xs text-secondary truncate flex-1 min-w-0">
                          {t('sidebar.characterNameWithId', {
                            name: character?.name || t('sidebar.unknownCharacter'),
                          })}
                        </p>
                        <div className="w-[26px] shrink-0 flex justify-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleToggleLock(thread)
                            }}
                            className={`w-[26px] h-[26px] flex items-center justify-center rounded hover:bg-surface-hover ${thread.isLocked ? 'text-primary' : 'text-tertiary hover:text-text'}`}
                            aria-label={thread.isLocked ? t('sidebar.unlock') : t('sidebar.lock')}
                            title={thread.isLocked ? t('sidebar.unlock') : t('sidebar.lock')}
                          >
                            {thread.isLocked ? (
                              <Lock className="w-3.5 h-3.5" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="w-[26px] shrink-0 flex justify-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (colorPickerId === thread.id) {
                                setColorPickerId(null)
                                setColorPickerPos(null)
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setColorPickerPos({
                                  top: rect.bottom + 4,
                                  left: Math.max(8, rect.right - 224),
                                })
                                setColorPickerId(thread.id)
                              }
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation()
                            }}
                            className={`w-[26px] h-[26px] flex items-center justify-center rounded hover:bg-surface-hover ${threadColor ? '' : 'text-tertiary hover:text-text'}`}
                            style={threadColor ? { color: threadColor } : undefined}
                            aria-label={t('sidebar.color')}
                            title={t('sidebar.color')}
                          >
                            <Palette
                              className="w-3.5 h-3.5"
                              style={threadColor ? { fill: threadColor } : undefined}
                            />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-auto justify-end">
                        {!thread.isLocked && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              toggleSelect(thread.id)
                            }}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-tertiary hover:text-text hover:bg-surface-hover flex-shrink-0"
                            aria-label={t('sidebar.selectThreads')}
                          >
                            {selectedIds.has(thread.id) ? (
                              <CheckSquare className="w-4 h-4" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleEditCharacter(thread)
                          }}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-tertiary hover:text-text hover:bg-surface-hover"
                          aria-label={t('sidebar.editCharacter')}
                          title={t('sidebar.editCharacter')}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDuplicate(thread)
                          }}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-tertiary hover:text-text hover:bg-surface-hover"
                          aria-label={t('sidebar.duplicateThread')}
                          title={t('sidebar.duplicateThread')}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleToggleFavorite(thread)
                          }}
                          className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-surface-hover ${thread.isFavorite ? 'text-yellow-500' : 'text-tertiary hover:text-text'}`}
                          aria-label={
                            thread.isFavorite ? t('sidebar.unfavorite') : t('sidebar.favorite')
                          }
                          title={
                            thread.isFavorite ? t('sidebar.unfavorite') : t('sidebar.favorite')
                          }
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${thread.isFavorite ? 'fill-yellow-500' : ''}`}
                          />
                        </button>
                        {!thread.isLocked && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleDelete(thread)
                            }}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded bg-delete text-on-delete hover:bg-delete-hover"
                            aria-label={t('sidebar.deleteThread')}
                            title={t('sidebar.deleteThread')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              )
            })
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="border-t border-border px-3 py-2 shrink-0 flex items-center gap-3">
            <span className="text-sm text-secondary">
              {t('sidebar.selectedCount', { count: selectedIds.size })}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleBatchDelete}
              className="min-h-[44px] px-4 rounded-md text-sm font-medium text-on-delete bg-delete hover:bg-delete-hover flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {t('sidebar.deleteSelected')}
            </button>
          </div>
        )}

        {(() => {
          const navButtons = [
            {
              onClick: () => openModal('personaManagement'),
              icon: UserPlus,
              labelKey: 'sidebar.personas',
            },
            {
              onClick: () => openModal('writingInstructionManagement'),
              icon: FileText,
              labelKey: 'sidebar.writingInstructions',
            },
            {
              onClick: () => openModal('profileManagement'),
              icon: SlidersHorizontal,
              labelKey: 'sidebar.connectionProfiles',
            },
            {
              onClick: () => openModal('inChatShortcutManagement'),
              icon: Zap,
              labelKey: 'sidebar.inChatShortcuts',
            },
            { onClick: null, icon: BookOpen, labelKey: 'sidebar.lorebooks' },
            { onClick: () => openModal('tagManagement'), icon: Tags, labelKey: 'sidebar.tags' },
            {
              onClick: () => openModal('localInference'),
              icon: BrainCog,
              labelKey: 'sidebar.localInference',
            },
            { onClick: () => openModal('settings'), icon: Settings, labelKey: 'topbar.settings' },
          ]
          if (sidebarNavLayout === 'compact') {
            return (
              <div className="border-t border-border p-3 shrink-0 flex flex-wrap gap-1">
                {navButtons.map((btn) => (
                  <button
                    key={btn.labelKey}
                    onClick={btn.onClick || undefined}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-secondary hover:text-text hover:bg-surface-hover"
                    title={t(btn.labelKey)}
                  >
                    <btn.icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            )
          }
          return (
            <div className="border-t border-border p-3 shrink-0 space-y-1">
              {navButtons.map((btn) => (
                <button
                  key={btn.labelKey}
                  onClick={btn.onClick || undefined}
                  className="flex items-center gap-2 w-full min-h-[44px] px-3 rounded-md text-sm text-secondary hover:text-text hover:bg-surface-hover"
                >
                  <btn.icon className="w-4 h-4" />
                  {t(btn.labelKey)}
                </button>
              ))}
            </div>
          )
        })()}
      </aside>

      {colorPickerId &&
        colorPickerPos &&
        createPortal(
          (() => {
            const thread = threads.find((t) => t.id === colorPickerId)
            if (!thread) return null
            return (
              <div
                ref={colorPickerRef}
                className="fixed bg-surface border border-border rounded-md shadow-surface-md z-50 p-1.5"
                style={{ top: colorPickerPos.top, left: colorPickerPos.left }}
              >
                <ColorPicker
                  value={thread.color || ''}
                  onChange={(c) => {
                    handleColorSelect(thread, c)
                  }}
                />
              </div>
            )
          })(),
          document.body,
        )}
    </>
  )
}

export default Sidebar
