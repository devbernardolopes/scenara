import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useConfirm } from '../../lib/confirm'
import { showToast } from '../../lib/toast'
import { downloadJson } from '../../lib/download'
import { getLogs, deleteLogs, clearLogs, exportLogs } from '../../services/logs'
import { getAllThreads } from '../../services/threads'
import { getUIState, setUIState } from '../../services/uiState'
import CloseButton from '../shared/CloseButton'
import { Search, Trash2, Download, ScrollText, ChevronDown } from '../../lib/icons'

const FILTERS_KEY = 'logsModal.filters'
const FILTERS_COLLAPSED_KEY = 'logsModal.filtersCollapsed'

const DEFAULT_FILTERS = {
  type: '',
  threadId: '',
  level: '',
  search: '',
  sort: 'desc',
}

const TYPES = ['toast', 'api', 'error']
const LEVELS = ['info', 'success', 'warning', 'error']

function levelClass(level) {
  switch (level) {
    case 'error':
      return 'bg-error/10 text-error'
    case 'warning':
      return 'bg-warning/10 text-warning'
    case 'success':
      return 'bg-success/10 text-success'
    default:
      return 'bg-primary-subtle text-primary'
  }
}

function LogsModal() {
  const { t } = useTranslation(['common', 'logs'])
  const { openModal, closeModal } = useModal()
  const { confirm } = useConfirm()
  const [logs, setLogs] = useState([])
  const [threads, setThreads] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [filtersCollapsed, setFiltersCollapsed] = useState(true)
  const searchRef = useRef(null)

  useEffect(() => {
    getUIState(FILTERS_KEY).then((saved) => {
      if (saved && typeof saved === 'object') {
        setFilters({ ...DEFAULT_FILTERS, ...saved })
      }
    })
    getUIState(FILTERS_COLLAPSED_KEY).then((saved) => {
      if (saved !== null) setFiltersCollapsed(!!saved)
    })
  }, [])

  const load = useCallback(async () => {
    const rows = await getLogs(filters)
    setLogs(rows)
  }, [filters])

  useEffect(() => {
    getAllThreads().then((all) => setThreads(all))
  }, [])

  useEffect(() => {
    setUIState(FILTERS_KEY, filters)
  }, [filters])

  useEffect(() => {
    setUIState(FILTERS_COLLAPSED_KEY, filtersCollapsed)
  }, [filtersCollapsed])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (filters.threadId && !threads.some((t) => String(t.id) === String(filters.threadId))) {
      setFilters((f) => ({ ...f, threadId: '' }))
    }
  }, [threads, filters.threadId])

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      if (prev.size === logs.length && logs.length > 0) return new Set()
      return new Set(logs.map((l) => l.id))
    })
  }

  async function handleClearAll() {
    const ok = await confirm({
      title: t('logs:clearConfirmTitle'),
      message: t('logs:clearConfirmMessage'),
      confirmLabel: t('common:confirm'),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (!ok) return
    await clearLogs()
    setSelectedIds(new Set())
    await load()
    showToast(t('logs:cleared'), { type: 'success' })
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return
    const ok = await confirm({
      title: t('logs:deleteConfirmTitle'),
      message: t('logs:deleteConfirmMessage', { count: validSelectedCount }),
      confirmLabel: t('common:confirm'),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (!ok) return
    await deleteLogs([...selectedIds])
    setSelectedIds(new Set())
    await load()
  }

  async function handleExport() {
    const rows = await exportLogs({
      type: filters.type || null,
      threadId: filters.threadId || null,
      search: filters.search || '',
    })
    downloadJson({ logs: rows }, 'logs-export.json')
  }

  function openDetails(log) {
    openModal('logDetails', { log })
  }

  function formatTime(ts) {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString()
  }

  function summaryFor(log) {
    if (log.type === 'api') {
      return `${log.kind || 'api'} · ${log.providerId || ''}${log.model ? ` · ${log.model}` : ''}${
        log.durationMs != null ? ` · ${log.durationMs}ms` : ''
      }`
    }
    if (log.type === 'error') return log.message || ''
    return log.message || ''
  }

  const validSelectedCount = logs.filter((l) => selectedIds.has(l.id)).length
  const allChecked = logs.length > 0 && validSelectedCount === logs.length
  const activeFilterCount = [filters.type, filters.level, filters.threadId].filter(Boolean).length

  function toggleFilters() {
    setFiltersCollapsed((prev) => !prev)
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 border-b border-border shrink-0">
        <h2 className="text-xl font-semibold text-text">{t('logs:title')}</h2>
        <CloseButton onClick={closeModal} />
      </div>

      <div className="p-6 pt-4 space-y-2 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary pointer-events-none" />
          <input
            ref={searchRef}
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder={t('logs:search')}
            className="w-full min-h-[44px] pl-10 pr-3 text-sm bg-surface border border-border rounded-md text-text placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          type="button"
          onClick={toggleFilters}
          className="flex items-center gap-2 min-h-[44px] px-1 w-full text-left"
        >
          <ChevronDown
            className={`w-4 h-4 text-tertiary transition-transform duration-200 ${filtersCollapsed ? '' : 'rotate-180'}`}
          />
          <span className="text-sm text-secondary">{t('logs:filters')}</span>
          {activeFilterCount > 0 && (
            <span className="text-[11px] leading-none px-1.5 py-0.5 rounded bg-primary-subtle text-primary font-medium">
              {activeFilterCount}
            </span>
          )}
        </button>
        <div
          className="overflow-hidden transition-all duration-200"
          style={{ maxHeight: filtersCollapsed ? 0 : '200px' }}
        >
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <select
              value={filters.type}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
              className="min-h-[44px] px-3 text-sm bg-surface border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{t('logs:filterType')}</option>
              {TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {t(`logs:types.${tp}`)}
                </option>
              ))}
            </select>
            <select
              value={filters.level}
              onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))}
              className="min-h-[44px] px-3 text-sm bg-surface border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{t('logs:filterLevel')}</option>
              {LEVELS.map((lv) => (
                <option key={lv} value={lv}>
                  {t(`logs:levels.${lv}`)}
                </option>
              ))}
            </select>
            <select
              value={filters.threadId}
              onChange={(e) => setFilters((f) => ({ ...f, threadId: e.target.value }))}
              className="min-h-[44px] px-3 text-sm bg-surface border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{t('logs:filterThread')}</option>
              {threads.map((thr) => (
                <option key={thr.id} value={thr.id}>
                  {thr.title || `#${thr.threadNumber}`}
                </option>
              ))}
            </select>
            <select
              value={filters.sort}
              onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}
              className="min-h-[44px] px-3 text-sm bg-surface border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="desc">{t('logs:sortNewest')}</option>
              <option value="asc">{t('logs:sortOldest')}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-tertiary gap-2">
            <ScrollText className="w-8 h-8" />
            <p className="text-sm">{t('logs:noEntries')}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 pb-1">
              <label className="flex items-center min-h-[44px] min-w-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
              </label>
              <span className="text-xs text-tertiary">
                {t('logs:selectedCount', { count: validSelectedCount })}
              </span>
            </div>

            <div className="space-y-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-3 p-2 rounded-md border cursor-pointer hover:bg-surface-hover ${
                    selectedIds.has(log.id) ? 'border-primary ring-1 ring-primary' : 'border-border'
                  }`}
                  onClick={() => openDetails(log)}
                >
                  <label
                    className="flex items-center min-h-[44px] min-w-[44px] cursor-pointer shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(log.id)}
                      onChange={() => toggleSelect(log.id)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[11px] leading-none px-1.5 py-0.5 rounded font-medium ${levelClass(
                          log.level,
                        )}`}
                      >
                        {t(`logs:types.${log.type}`)}
                      </span>
                      <span className="text-xs text-tertiary">{formatTime(log.createdAt)}</span>
                    </div>
                    <p className="text-sm text-text truncate mt-1">{summaryFor(log)}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 px-6 py-4 border-t border-border shrink-0">
        <button
          type="button"
          onClick={handleExport}
          disabled={logs.length === 0}
          className="min-h-[44px] px-3 text-sm text-text hover:bg-surface-hover rounded-md border border-border inline-flex items-center gap-2 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {t('logs:export')}
        </button>
        <button
          type="button"
          onClick={handleDeleteSelected}
          disabled={validSelectedCount === 0}
          className="min-h-[44px] px-3 text-sm text-on-delete bg-delete hover:bg-delete-hover rounded-md inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4" />
          {t('logs:deleteSelected', { count: validSelectedCount })}
        </button>
        <button
          type="button"
          onClick={handleClearAll}
          disabled={logs.length === 0}
          className="min-h-[44px] px-3 text-sm text-text hover:bg-surface-hover rounded-md border border-border inline-flex items-center gap-2 disabled:opacity-50 ml-auto"
        >
          <Trash2 className="w-4 h-4" />
          {t('logs:clearAll')}
        </button>
      </div>
    </div>
  )
}

export default LogsModal
