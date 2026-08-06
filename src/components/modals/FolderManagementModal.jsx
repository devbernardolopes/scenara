import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useConfirm } from '../../lib/confirm'
import {
  getAllFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  getFolderCharacterCounts,
  reorderFolders,
} from '../../services/folders'
import CloseButton from '../shared/CloseButton'
import { useModalScrollPosition } from '../../hooks/useModalScrollPosition'
import { SortableList, SortableItem } from '../shared/SortableList'
import { Plus, X, GripVertical } from '../../lib/icons'

function FolderManagementModal() {
  const { t } = useTranslation('common')
  const { closeModal } = useModal()
  const { confirm } = useConfirm()
  const { scrollRef, onScroll } = useModalScrollPosition('folders')
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [editingFolder, setEditingFolder] = useState(null)
  const [characterCounts, setCharacterCounts] = useState(new Map())
  const inputRef = useRef(null)

  const firstLoad = useRef(true)
  const load = useCallback(async () => {
    if (firstLoad.current) setLoading(true)
    try {
      const [data, counts] = await Promise.all([getAllFolders(), getFolderCharacterCounts()])
      setFolders(data)
      setCharacterCounts(counts)
    } finally {
      if (firstLoad.current) {
        setLoading(false)
        firstLoad.current = false
      }
    }
  }, [])

  useEffect(() => {
    load()
    window.addEventListener('folders-changed', load)
    return () => window.removeEventListener('folders-changed', load)
  }, [load])

  async function handleSubmit(e) {
    e?.preventDefault()
    const name = inputValue.trim()
    if (!name) return
    if (editingFolder) {
      try {
        await updateFolder(editingFolder.id, name)
      } catch {
        return
      }
    } else {
      try {
        await createFolder(name)
      } catch {
        return
      }
    }
    setInputValue('')
    setEditingFolder(null)
    inputRef.current?.focus()
  }

  function handleSelectFolder(folder) {
    setInputValue(folder.name)
    setEditingFolder(folder)
    inputRef.current?.focus()
  }

  function handleCancelEdit() {
    setInputValue('')
    setEditingFolder(null)
    inputRef.current?.focus()
  }

  async function handleDelete(folder) {
    const count = characterCounts.get(folder.id) || 0
    const ok = await confirm({
      title: t('folders.confirmDelete.title'),
      message:
        count > 0
          ? t('folders.confirmDelete.messageWithChars', { name: folder.name, count })
          : t('folders.confirmDelete.message', { name: folder.name }),
      confirmLabel: t('folders.confirmDelete.confirm'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    })
    if (!ok) return
    await deleteFolder(folder.id)
    if (editingFolder?.id === folder.id) {
      setInputValue('')
      setEditingFolder(null)
    }
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 shadow-section shrink-0">
        <h2 className="text-xl font-semibold text-text">{t('folders.title')}</h2>
        <CloseButton onClick={closeModal} />
      </div>

      <div className="px-6 py-3 border-b border-border shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t('folders.placeholder')}
              className="w-full min-h-[44px] px-3 pr-10 text-sm bg-surface border border-border rounded-md text-text placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {editingFolder && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
                aria-label={t('folders.cancelEdit')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="min-h-[44px] px-4 btn-primary text-sm flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            {editingFolder ? t('folders.update') : t('folders.add')}
          </button>
        </form>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-secondary text-sm">{t('loading')}</p>
          </div>
        ) : folders.length === 0 ? (
          <p className="text-sm text-secondary py-8 text-center">{t('folders.noFolders')}</p>
        ) : (
          <div className="space-y-2">
            <SortableList
              items={folders}
              getId={(f) => f.id}
              onReorder={(ids) => reorderFolders(ids)}
            >
              {(folder) => (
                <SortableItem id={folder.id} key={folder.id}>
                  {(sortable) => (
                    <div
                      ref={sortable.setNodeRef}
                      style={sortable.style}
                      className={`flex items-center gap-1 pr-1 rounded-lg border transition-colors ${
                        editingFolder?.id === folder.id
                          ? 'border-primary bg-primary-subtle'
                          : 'border-border bg-surface-secondary'
                      }`}
                    >
                      <button
                        type="button"
                        {...sortable.dragHandleProps}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text cursor-grab touch-none"
                        aria-label={t('list.actions.reorder')}
                        title={t('list.actions.reorder')}
                      >
                        <GripVertical className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectFolder(folder)}
                        className="flex-1 min-h-[44px] flex items-center gap-2 px-1 text-sm text-text text-left hover:text-primary"
                        title={t('list.actions.edit')}
                      >
                        <span className="truncate">{folder.name}</span>
                        {(characterCounts.get(folder.id) || 0) > 0 && (
                          <span className="text-xs text-tertiary shrink-0">
                            {characterCounts.get(folder.id)}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(folder)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-tertiary hover:text-delete hover:bg-surface-hover"
                        aria-label={t('folders.delete', { name: folder.name })}
                        title={t('folders.delete', { name: folder.name })}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </SortableItem>
              )}
            </SortableList>
          </div>
        )}
      </div>
    </div>
  )
}

export default FolderManagementModal
