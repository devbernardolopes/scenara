import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getAllLorebooks } from '../../../services/lorebooks'
import { getUIState, setUIState } from '../../../services/uiState'
import CollapsibleSection from '../../shared/CollapsibleSection'
import { X, Search, ArrowUpDown } from '../../../lib/icons'

const SORT_OPTIONS = ['name', 'createdAt']

function LorebooksSection({ form, onChange }) {
  const { t } = useTranslation('characterCreation')
  const { t: tc } = useTranslation('common')
  const [allLorebooks, setAllLorebooks] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const wrapperRef = useRef(null)

  const assignedIds = useMemo(() => form.lorebookIds || [], [form.lorebookIds])
  const assignedSet = useMemo(() => new Set(assignedIds), [assignedIds])

  const assignedLorebooks = useMemo(
    () => assignedIds.map((id) => allLorebooks.find((l) => l.id === id)).filter(Boolean),
    [allLorebooks, assignedIds],
  )

  const load = useCallback(async () => {
    const data = await getAllLorebooks()
    setAllLorebooks(data)
  }, [])

  useEffect(() => {
    load()
    getUIState('lorebooksSection.searchQuery').then((v) => v && setSearchQuery(v))
    getUIState('lorebooksSection.sortBy').then((v) => v && setSortBy(v))
    getUIState('lorebooksSection.sortOrder').then((v) => v && setSortOrder(v))
    window.addEventListener('lorebooks-changed', load)
    return () => window.removeEventListener('lorebooks-changed', load)
  }, [load])

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        // no-op for browse; kept symmetric with other sections
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const persistSearchQuery = useCallback((val) => {
    setSearchQuery(val)
    setUIState('lorebooksSection.searchQuery', val)
  }, [])

  const persistSortBy = useCallback((val) => {
    setSortBy(val)
    setUIState('lorebooksSection.sortBy', val)
  }, [])

  const persistSortOrder = useCallback((val) => {
    setSortOrder(val)
    setUIState('lorebooksSection.sortOrder', val)
  }, [])

  const filteredBrowse = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const list = q ? allLorebooks.filter((l) => l.name.toLowerCase().includes(q)) : allLorebooks
    const sorted = [...list]
    sorted.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortBy === 'createdAt') cmp = new Date(a.createdAt) - new Date(b.createdAt)
      return sortOrder === 'desc' ? -cmp : cmp
    })
    return sorted
  }, [allLorebooks, searchQuery, sortBy, sortOrder])

  function removeLorebookById(id) {
    onChange(
      'lorebookIds',
      assignedIds.filter((lid) => lid !== id),
    )
  }

  function toggleLorebook(id) {
    if (assignedSet.has(id)) removeLorebookById(id)
    else onChange('lorebookIds', [...assignedIds, id])
  }

  return (
    <div className="space-y-4">
      {assignedLorebooks.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {assignedLorebooks.map((lb) => (
            <span
              key={lb.id}
              className="inline-flex items-center gap-1 pl-3 pr-0.5 h-11 rounded-full border border-primary bg-primary-subtle text-primary text-sm"
            >
              <span className="truncate max-w-[160px]">{lb.name}</span>
              <button
                type="button"
                onClick={() => removeLorebookById(lb.id)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-surface-hover -mr-1"
                aria-label={t('lorebooksSectionRemove', { name: lb.name })}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-tertiary text-center py-4">{t('lorebooksSectionNoLorebooks')}</p>
      )}

      <CollapsibleSection
        label={t('lorebooksSectionBrowseLorebooks')}
        summary={
          searchQuery || sortBy !== 'name' || sortOrder !== 'asc'
            ? t('tagsSectionBrowseActive')
            : ''
        }
        storageKey={`charSection.lorebooks.${form.lorebookIds?.length || 0}`}
        defaultExpanded={false}
      >
        <div className="pt-1 pb-2 space-y-3" ref={wrapperRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => persistSearchQuery(e.target.value)}
              placeholder={t('lorebooksSectionSearchPlaceholder')}
              className="w-full min-h-[44px] pl-10 pr-10 text-sm bg-surface border border-border rounded-md text-text placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => persistSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
                aria-label={t('tagsSectionSearchClear')}
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
                className="min-h-[44px] px-3 py-2 text-sm bg-surface border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-primary"
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
        {filteredBrowse.length === 0 ? (
          <p className="text-sm text-secondary py-4 text-center">
            {searchQuery ? tc('tags.noResults') : t('lorebooksSectionNoLorebooksBrowse')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredBrowse.map((lb) => (
              <button
                key={lb.id}
                type="button"
                onClick={() => toggleLorebook(lb.id)}
                className={`inline-flex items-center h-11 px-3 rounded-full border text-sm transition-colors ${
                  assignedSet.has(lb.id)
                    ? 'border-primary bg-primary-subtle text-primary'
                    : 'border-border bg-surface-secondary text-text hover:border-border-light'
                }`}
              >
                <span className="truncate max-w-[160px]">{lb.name}</span>
              </button>
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  )
}

export default LorebooksSection
