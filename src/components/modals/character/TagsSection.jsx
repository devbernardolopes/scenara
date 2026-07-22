import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getAllTags, createTag } from '../../../services/tags'
import { getUIState, setUIState } from '../../../services/uiState'
import CollapsibleSection from '../../shared/CollapsibleSection'
import { X, Search, ArrowUpDown } from '../../../lib/icons'

const MAX_SUGGESTIONS = 6
const SORT_OPTIONS = ['name', 'createdAt']

function TagsSection({ form, onChange }) {
  const { t } = useTranslation('characterCreation')
  const { t: tc } = useTranslation('common')
  const [allTags, setAllTags] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const inputRef = useRef(null)
  const wrapperRef = useRef(null)

  const assignedIds = useMemo(() => form.tags || [], [form.tags])
  const assignedSet = useMemo(() => new Set(assignedIds), [assignedIds])

  const assignedTags = useMemo(
    () => assignedIds.map((id) => allTags.find((t) => t.id === id)).filter(Boolean),
    [allTags, assignedIds],
  )

  const load = useCallback(async () => {
    const data = await getAllTags()
    setAllTags(data)
  }, [])

  useEffect(() => {
    load()
    getUIState('tagsSection.searchQuery').then((v) => v && setSearchQuery(v))
    getUIState('tagsSection.sortBy').then((v) => v && setSortBy(v))
    getUIState('tagsSection.sortOrder').then((v) => v && setSortOrder(v))
    window.addEventListener('tags-changed', load)
    return () => window.removeEventListener('tags-changed', load)
  }, [load])

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const persistSearchQuery = useCallback((val) => {
    setSearchQuery(val)
    setUIState('tagsSection.searchQuery', val)
  }, [])

  const persistSortBy = useCallback((val) => {
    setSortBy(val)
    setUIState('tagsSection.sortBy', val)
  }, [])

  const persistSortOrder = useCallback((val) => {
    setSortOrder(val)
    setUIState('tagsSection.sortOrder', val)
  }, [])

  const suggestions = useMemo(() => {
    const q = inputValue.toLowerCase().trim()
    if (!q) return []
    return allTags
      .filter((tag) => !assignedSet.has(tag.id) && tag.name.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS)
  }, [allTags, inputValue, assignedSet])

  const filteredBrowseTags = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return allTags
    return allTags.filter((tag) => tag.name.toLowerCase().includes(q))
  }, [allTags, searchQuery])

  const sortedBrowseTags = useMemo(() => {
    const list = [...filteredBrowseTags]
    list.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortBy === 'createdAt') cmp = new Date(a.createdAt) - new Date(b.createdAt)
      return sortOrder === 'desc' ? -cmp : cmp
    })
    return list
  }, [filteredBrowseTags, sortBy, sortOrder])

  async function addTagByName(name) {
    const trimmed = name.trim()
    if (!trimmed) return
    const existing = allTags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      if (!assignedSet.has(existing.id)) {
        onChange('tags', [...assignedIds, existing.id])
      }
    } else {
      try {
        const id = await createTag(trimmed)
        onChange('tags', [...assignedIds, id])
      } catch {
        return
      }
    }
  }

  function removeTagById(id) {
    onChange(
      'tags',
      assignedIds.filter((tid) => tid !== id),
    )
  }

  function toggleTag(id) {
    if (assignedSet.has(id)) removeTagById(id)
    else onChange('tags', [...assignedIds, id])
  }

  function handleSubmit(e) {
    e.preventDefault()
    const parts = inputValue.split(',')
    for (const part of parts) {
      addTagByName(part)
    }
    setInputValue('')
    setShowSuggestions(false)
  }

  function handleInputChange(e) {
    const val = e.target.value
    if (val.includes(',')) {
      const parts = val.split(',')
      for (const part of parts) {
        addTagByName(part)
      }
      setInputValue('')
      setShowSuggestions(false)
      return
    }
    setInputValue(val)
    setShowSuggestions(val.trim().length > 0)
  }

  function handleSuggestionClick(tag) {
    if (!assignedSet.has(tag.id)) {
      onChange('tags', [...assignedIds, tag.id])
    }
    setInputValue('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      setShowSuggestions(false)
      return
    }
  }

  return (
    <div className="space-y-4">
      {assignedTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {assignedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 pl-3 pr-0.5 h-11 rounded-full border border-primary bg-primary-subtle text-primary text-sm"
            >
              <span className="truncate max-w-[160px]">{tag.name}</span>
              <button
                type="button"
                onClick={() => removeTagById(tag.id)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-surface-hover -mr-1"
                aria-label={tc('tags.delete', { name: tag.name })}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-tertiary text-center py-4">{t('tagsSectionNoTags')}</p>
      )}

      <form onSubmit={handleSubmit} className="relative" ref={wrapperRef}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={t('tagsSectionPlaceholder')}
          className="w-full min-h-[44px] px-3 text-sm bg-surface bg-surface-secondary border border-border rounded-md text-text placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-md shadow-surface-md max-h-60 overflow-y-auto">
            {suggestions.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSuggestionClick(tag)
                }}
                className="w-full text-left px-3 min-h-[44px] flex items-center text-sm text-text hover:bg-surface-hover"
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </form>

      <CollapsibleSection
        label={t('tagsSectionBrowseTags')}
        summary={
          searchQuery || sortBy !== 'name' || sortOrder !== 'asc'
            ? t('tagsSectionBrowseActive')
            : ''
        }
        storageKey={`charSection.tags.${form.tags?.length || 0}`}
        defaultExpanded={false}
      >
        <div className="pt-1 pb-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => persistSearchQuery(e.target.value)}
              placeholder={tc('tags.searchPlaceholder')}
              className="w-full min-h-[44px] pl-10 pr-10 text-sm bg-surface bg-surface-secondary border border-border rounded-md text-text placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => persistSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
                aria-label={tc('tags.searchClear')}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-secondary whitespace-nowrap">
                {tc('tags.sort.label')}
              </span>
              <select
                value={sortBy}
                onChange={(e) => persistSortBy(e.target.value)}
                className="min-h-[44px] px-3 py-2 text-sm bg-surface bg-surface-secondary border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {SORT_OPTIONS.map((key) => (
                  <option key={key} value={key}>
                    {tc(`tags.sort.${key}`)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => persistSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-3 border border-border rounded-md text-sm text-text hover:bg-surface-hover"
              title={tc(`tags.order.${sortOrder === 'asc' ? 'desc' : 'asc'}`)}
            >
              <ArrowUpDown className="w-4 h-4" />
              <span className="text-xs text-secondary">{tc(`tags.order.${sortOrder}`)}</span>
            </button>
          </div>
        </div>
        {sortedBrowseTags.length === 0 ? (
          <p className="text-sm text-secondary py-4 text-center">
            {searchQuery ? tc('tags.noResults') : tc('tags.noTags')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sortedBrowseTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`inline-flex items-center h-11 px-3 rounded-full border text-sm transition-colors ${
                  assignedSet.has(tag.id)
                    ? 'border-primary bg-primary-subtle text-primary'
                    : 'border-border bg-surface-secondary text-text hover:border-border-light'
                }`}
              >
                <span className="truncate max-w-[160px]">{tag.name}</span>
              </button>
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  )
}

export default TagsSection
