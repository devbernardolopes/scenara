import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useConfirm } from '../../lib/confirm'
import {
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
  getTagCharacterCounts,
} from '../../services/tags'
import { getUIState, setUIState } from '../../services/uiState'
import CollapsibleSection from '../shared/CollapsibleSection'
import CloseButton from '../shared/CloseButton'
import { Plus, Search, X, ArrowUpDown } from '../../lib/icons'

const SORT_OPTIONS = ['name', 'createdAt']

function TagManagementModal() {
  const { t } = useTranslation('common')
  const { closeModal } = useModal()
  const { confirm } = useConfirm()
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [editingTag, setEditingTag] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [characterCounts, setCharacterCounts] = useState(new Map())
  const inputRef = useRef(null)

  const firstLoad = useRef(true)
  const load = useCallback(async () => {
    if (firstLoad.current) setLoading(true)
    try {
      const [data, counts] = await Promise.all([getAllTags(), getTagCharacterCounts()])
      setTags(data)
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
    getUIState('tagManagement.searchQuery').then((val) => val && setSearchQuery(val))
    getUIState('tagManagement.sortBy').then((val) => val && setSortBy(val))
    getUIState('tagManagement.sortOrder').then((val) => val && setSortOrder(val))
    window.addEventListener('tags-changed', load)
    return () => window.removeEventListener('tags-changed', load)
  }, [load])

  const persistSearchQuery = useCallback((val) => {
    setSearchQuery(val)
    setUIState('tagManagement.searchQuery', val)
  }, [])

  const persistSortBy = useCallback((val) => {
    setSortBy(val)
    setUIState('tagManagement.sortBy', val)
  }, [])

  const persistSortOrder = useCallback((val) => {
    setSortOrder(val)
    setUIState('tagManagement.sortOrder', val)
  }, [])

  const filteredTags = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return tags
    return tags.filter((tag) => tag.name.toLowerCase().includes(q))
  }, [tags, searchQuery])

  const sortedTags = useMemo(() => {
    const list = [...filteredTags]
    list.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'createdAt':
          cmp = new Date(a.createdAt) - new Date(b.createdAt)
          break
      }
      return sortOrder === 'desc' ? -cmp : cmp
    })
    return list
  }, [filteredTags, sortBy, sortOrder])

  async function handleSubmit(e) {
    e?.preventDefault()
    const name = inputValue.trim()
    if (!name) return
    if (editingTag) {
      try {
        await updateTag(editingTag.id, name)
      } catch {
        return
      }
    } else {
      try {
        await createTag(name)
      } catch {
        return
      }
    }
    setInputValue('')
    setEditingTag(null)
    inputRef.current?.focus()
  }

  function handleSelectTag(tag) {
    setInputValue(tag.name)
    setEditingTag(tag)
    inputRef.current?.focus()
  }

  function handleCancelEdit() {
    setInputValue('')
    setEditingTag(null)
    inputRef.current?.focus()
  }

  async function handleDelete(tag) {
    const count = characterCounts.get(tag.id) || 0
    const ok = await confirm({
      title: t('tags.confirmDelete.title'),
      message:
        count > 0
          ? t('tags.confirmDelete.messageWithChars', { name: tag.name, count })
          : t('tags.confirmDelete.message', { name: tag.name }),
      confirmLabel: t('tags.confirmDelete.confirm'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    })
    if (!ok) return
    await deleteTag(tag.id)
    if (editingTag?.id === tag.id) {
      setInputValue('')
      setEditingTag(null)
    }
  }

  const filterControl = (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-secondary whitespace-nowrap">{t('tags.sort.label')}</span>
        <select
          value={sortBy}
          onChange={(e) => persistSortBy(e.target.value)}
          className="min-h-[44px] px-3 py-2 text-sm bg-surface border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {SORT_OPTIONS.map((key) => (
            <option key={key} value={key}>
              {t(`tags.sort.${key}`)}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => persistSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-3 border border-border rounded-md text-sm text-text hover:bg-surface-hover"
        title={t(`tags.order.${sortOrder === 'asc' ? 'desc' : 'asc'}`)}
      >
        <ArrowUpDown className="w-4 h-4" />
        <span className="text-xs text-secondary">{t(`tags.order.${sortOrder}`)}</span>
      </button>
    </div>
  )

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 shadow-section shrink-0">
        <h2 className="text-xl font-semibold text-text">{t('tags.title')}</h2>
        <CloseButton onClick={closeModal} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t('tags.placeholder')}
                className="w-full min-h-[44px] px-3 pr-10 text-sm bg-surface border border-border rounded-md text-text placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {editingTag && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
                  aria-label={t('tags.cancelEdit')}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="min-h-[44px] px-4 btn-primary text-sm flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              {editingTag ? t('tags.update') : t('tags.add')}
            </button>
          </form>

          <CollapsibleSection
            label={<span className="flex items-center gap-2">{t('tags.filter.title')}</span>}
            summary={
              searchQuery || sortBy !== 'name' || sortOrder !== 'asc' ? t('tags.filter.active') : ''
            }
            storageKey="tagManagementFilters"
            defaultExpanded={false}
          >
            <div className="pt-1 pb-2 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => persistSearchQuery(e.target.value)}
                  placeholder={t('tags.searchPlaceholder')}
                  className="w-full min-h-[44px] pl-10 pr-10 text-sm bg-surface border border-border rounded-md text-text placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => persistSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
                    aria-label={t('tags.searchClear')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {filterControl}
            </div>
          </CollapsibleSection>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-secondary text-sm">{t('loading')}</p>
            </div>
          ) : sortedTags.length === 0 ? (
            <p className="text-sm text-secondary py-8 text-center">
              {searchQuery ? t('tags.noResults') : t('tags.noTags')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sortedTags.map((tag) => (
                <div
                  key={tag.id}
                  className={`inline-flex items-center gap-1 pl-3 pr-0.5 h-11 rounded-full border text-sm transition-colors cursor-pointer ${
                    editingTag?.id === tag.id
                      ? 'border-primary bg-primary-subtle text-primary'
                      : 'border-border bg-surface-secondary text-text hover:border-border-light'
                  }`}
                  onClick={() => handleSelectTag(tag)}
                >
                  <span className="truncate max-w-[160px]">{tag.name}</span>
                  {(characterCounts.get(tag.id) || 0) > 0 && (
                    <span className="text-xs text-tertiary shrink-0 ml-0.5">
                      {characterCounts.get(tag.id)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(tag)
                    }}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-tertiary hover:text-delete hover:bg-surface-hover -mr-1"
                    aria-label={t('tags.delete', { name: tag.name })}
                    title={t('tags.delete', { name: tag.name })}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TagManagementModal
