import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  getAllThreads,
  deleteThread,
  deleteThreads,
  toggleFavorite,
  updateThreadColor,
  duplicateThread,
} from '../../services/threads'
import { getCharacter, importCharacterFromFile } from '../../services/characters'
import { useModal } from '../../hooks/useModal'
import { useConfirm } from '../../lib/confirm'
import { showToast } from '../../lib/toast'
import CloseButton from '../shared/CloseButton'
import Avatar from '../shared/Avatar'
import {
  UserPlus,
  Settings,
  Edit3,
  Trash2,
  Copy,
  Star,
  Palette,
  CheckSquare,
  Square,
  FileText,
  Zap,
  BookOpen,
  Tags,
  Database,
  Plus,
  Upload,
  Globe,
  FileUp,
} from '../../lib/icons'

const COLOR_PRESETS = [
  '#fef2f2',
  '#fff7ed',
  '#fefce8',
  '#f0fdf4',
  '#ecfeff',
  '#eff6ff',
  '#faf5ff',
  '#fdf2f8',
  '',
]

function Sidebar({ open, onClose }) {
  const { t } = useTranslation('common')
  const { threadId } = useParams()
  const navigate = useNavigate()
  const { openModal } = useModal()
  const { confirm } = useConfirm()
  const [threads, setThreads] = useState([])
  const [characters, setCharacters] = useState({})
  const [colorPickerId, setColorPickerId] = useState(null)
  const colorPickerRef = useRef(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showImportMenu, setShowImportMenu] = useState(false)
  const fileInputRef = useRef(null)

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
  }, [])

  useEffect(() => {
    loadData()
    window.addEventListener('threads-changed', loadData)
    return () => window.removeEventListener('threads-changed', loadData)
  }, [loadData])

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
    await duplicateThread(thread.id)
  }

  async function handleToggleFavorite(thread) {
    await toggleFavorite(thread.id)
  }

  async function handleColorSelect(thread, color) {
    await updateThreadColor(thread.id, color)
    setColorPickerId(null)
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
    if (selectedIds.size === threads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(threads.map((t) => t.id)))
    }
  }

  async function handleBatchDelete() {
    const ok = await confirm({
      title: t('sidebar.confirmBatchDeleteTitle'),
      message: t('sidebar.confirmBatchDeleteMessage', { count: selectedIds.size }),
      confirmLabel: t('sidebar.deleteSelected'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    })
    if (!ok) return
    const hadActive = [...selectedIds].some((id) => String(id) === threadId)
    await deleteThreads([...selectedIds])
    setSelectedIds(new Set())
    if (hadActive) navigate('/')
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-overlay z-30 md:hidden" onClick={onClose} />}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-72 bg-surface-secondary border-r border-border
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
          {threads.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-tertiary hover:text-text hover:bg-surface-hover"
              aria-label={
                selectedIds.size === threads.length
                  ? t('sidebar.deselectAll')
                  : t('sidebar.selectAll')
              }
              title={
                selectedIds.size === threads.length
                  ? t('sidebar.deselectAll')
                  : t('sidebar.selectAll')
              }
            >
              {selectedIds.size === threads.length ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
          )}
          {threads.length === 0 ? (
            <p className="text-xs text-tertiary px-3">{t('sidebar.newChat')}</p>
          ) : (
            threads.map((thread) => {
              const character = characters[thread.characterId]
              const isActive = String(thread.id) === threadId
              return (
                <div
                  key={thread.id}
                  className={`rounded-lg border ${isActive ? 'border-primary' : 'border-border'} overflow-hidden`}
                  style={{ backgroundColor: thread.color || undefined }}
                >
                  <Link to={`/chat/${thread.id}`} onClick={onClose} className="block p-3">
                    <div className="flex items-start gap-3">
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
                      <Avatar src={character?.avatar} size="sm" className="flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-text'}`}
                          >
                            {thread.title}
                          </span>
                          <span className="text-xs text-tertiary shrink-0">
                            #{thread.threadNumber}
                          </span>
                        </div>
                        <p className="text-xs text-secondary truncate mt-0.5">
                          {character?.name || t('sidebar.unknownCharacter')}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 px-3 pb-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          setColorPickerId(colorPickerId === thread.id ? null : thread.id)
                        }}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-tertiary hover:text-text hover:bg-surface-hover"
                        aria-label="Color"
                        title="Color"
                      >
                        <Palette className="w-3.5 h-3.5" />
                      </button>
                      {colorPickerId === thread.id && (
                        <div
                          ref={colorPickerRef}
                          className="absolute bottom-full left-0 mb-1 flex gap-1 p-1.5 bg-surface border border-border rounded-md shadow-surface-md z-10"
                        >
                          {COLOR_PRESETS.map((c, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleColorSelect(thread, c)
                              }}
                              className={`w-5 h-5 rounded-full border ${c ? 'border-border' : 'border-border'} ${thread.color === c ? 'ring-2 ring-primary' : ''}`}
                              style={c ? { backgroundColor: c } : undefined}
                              aria-label={c || 'None'}
                              title={c || 'None'}
                            >
                              {!c && (
                                <span className="flex items-center justify-center text-[10px] text-tertiary leading-none">
                                  /
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        handleEditTitle(thread)
                      }}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-tertiary hover:text-text hover:bg-surface-hover"
                      aria-label={t('editThreadTitle.title')}
                      title={t('editThreadTitle.title')}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        handleDelete(thread)
                      }}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-tertiary hover:text-error hover:bg-surface-hover"
                      aria-label={t('sidebar.deleteThread')}
                      title={t('sidebar.deleteThread')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
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
                        handleToggleFavorite(thread)
                      }}
                      className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-surface-hover ${thread.isFavorite ? 'text-yellow-500' : 'text-tertiary hover:text-text'}`}
                      aria-label={
                        thread.isFavorite ? t('sidebar.unfavorite') : t('sidebar.favorite')
                      }
                      title={thread.isFavorite ? t('sidebar.unfavorite') : t('sidebar.favorite')}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${thread.isFavorite ? 'fill-yellow-500' : ''}`}
                      />
                    </button>
                  </div>
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
              className="min-h-[44px] px-4 rounded-md text-sm font-medium text-on-primary bg-error hover:opacity-90 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {t('sidebar.deleteSelected')}
            </button>
          </div>
        )}

        <div className="border-t border-border p-3 shrink-0 space-y-1">
          <button
            onClick={() => openModal('personaManagement')}
            className="flex items-center gap-2 w-full min-h-[44px] px-3 rounded-md text-sm text-secondary hover:text-text hover:bg-surface-hover"
          >
            <UserPlus className="w-4 h-4" />
            {t('sidebar.personas')}
          </button>
          <button
            onClick={() => openModal('writingInstructionManagement')}
            className="flex items-center gap-2 w-full min-h-[44px] px-3 rounded-md text-sm text-secondary hover:text-text hover:bg-surface-hover"
          >
            <FileText className="w-4 h-4" />
            {t('sidebar.writingInstructions')}
          </button>
          <button className="flex items-center gap-2 w-full min-h-[44px] px-3 rounded-md text-sm text-secondary hover:text-text hover:bg-surface-hover">
            <Zap className="w-4 h-4" />
            {t('sidebar.inChatShortcuts')}
          </button>
          <button className="flex items-center gap-2 w-full min-h-[44px] px-3 rounded-md text-sm text-secondary hover:text-text hover:bg-surface-hover">
            <BookOpen className="w-4 h-4" />
            {t('sidebar.lorebooks')}
          </button>
          <button className="flex items-center gap-2 w-full min-h-[44px] px-3 rounded-md text-sm text-secondary hover:text-text hover:bg-surface-hover">
            <Tags className="w-4 h-4" />
            {t('sidebar.tags')}
          </button>
          <button className="flex items-center gap-2 w-full min-h-[44px] px-3 rounded-md text-sm text-secondary hover:text-text hover:bg-surface-hover">
            <Database className="w-4 h-4" />
            {t('sidebar.database')}
          </button>
          <button
            onClick={() => openModal('settings')}
            className="flex items-center gap-2 w-full min-h-[44px] px-3 rounded-md text-sm text-secondary hover:text-text hover:bg-surface-hover"
          >
            <Settings className="w-4 h-4" />
            {t('topbar.settings')}
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
