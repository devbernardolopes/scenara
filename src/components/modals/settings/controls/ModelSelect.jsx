import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  RefreshCw,
  X,
  ChevronDown,
  Star,
  Search,
  ArrowUpDown,
  SlidersHorizontal,
} from '../../../../lib/icons'
import { getFavModels, toggleFavModel } from '../../../../services/apiProviders'
import { getUIState, setUIState } from '../../../../services/uiState'
import CollapsibleSection from '../../../shared/CollapsibleSection'

const SORT_OPTIONS = ['name']

function formatEta(seconds) {
  if (seconds >= 60) {
    const mins = Math.round(seconds / 60)
    return `${mins}m`
  }
  return `${Math.round(seconds)}s`
}

function Pill({ children, className }) {
  return (
    <span
      className={`px-1.5 py-0.5 text-[11px] leading-none rounded font-medium shrink-0 ${className}`}
    >
      {children}
    </span>
  )
}

function ModelDropdown({
  models,
  modelNames,
  modelMeta,
  value,
  onChange,
  favModels,
  onToggleFav,
  selectLabel,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selectedMeta = modelMeta[value]

  function displayName(modelId) {
    return modelNames[modelId] || modelId
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface text-text text-sm text-left flex items-start gap-2"
      >
        <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2 flex-1 min-w-0">
          <span className={`truncate ${value ? '' : 'text-tertiary'}`}>
            {value ? displayName(value) : selectLabel}
          </span>
          {selectedMeta && (
            <span className="flex items-center gap-1 flex-wrap">
              {selectedMeta.count !== undefined && (
                <Pill
                  style={{
                    backgroundColor: 'var(--color-pill-count-bg)',
                    color: 'var(--color-pill-count-text)',
                  }}
                >
                  {selectedMeta.count}
                </Pill>
              )}
              {selectedMeta.queued !== undefined && (
                <Pill
                  style={{
                    backgroundColor: 'var(--color-pill-queued-bg)',
                    color: 'var(--color-pill-queued-text)',
                  }}
                >
                  {selectedMeta.queued}
                </Pill>
              )}
              {selectedMeta.eta !== undefined && (
                <Pill
                  style={{
                    backgroundColor: 'var(--color-pill-eta-bg)',
                    color: 'var(--color-pill-eta-text)',
                  }}
                >
                  {formatEta(selectedMeta.eta)}
                </Pill>
              )}
              {selectedMeta.performance !== undefined && (
                <Pill
                  style={{
                    backgroundColor: 'var(--color-pill-perf-bg)',
                    color: 'var(--color-pill-perf-text)',
                  }}
                >
                  {selectedMeta.performance} tok/s
                </Pill>
              )}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 border border-border rounded-md bg-surface text-text shadow-surface-lg max-h-72 overflow-y-auto">
          <div
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-tertiary hover:bg-surface-hover cursor-pointer min-h-[44px]"
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
          >
            {selectLabel}
          </div>
          {models.length === 0 && (
            <div className="px-3 py-2.5 text-sm text-tertiary">No models available</div>
          )}
          {models.map((model) => {
            const meta = modelMeta[model]
            const isFav = favModels.includes(model)
            return (
              <div
                key={model}
                className={`flex items-start gap-2 px-3 py-2.5 text-sm cursor-pointer min-h-[44px] ${
                  value === model ? 'bg-primary-subtle' : 'hover:bg-surface-hover'
                }`}
                onClick={() => {
                  onChange(model)
                  setOpen(false)
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleFav(model)
                  }}
                  className="shrink-0 focus:outline-none mt-0.5"
                >
                  <Star
                    className={`w-4 h-4 ${
                      isFav
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-tertiary hover:text-yellow-400'
                    }`}
                  />
                </button>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="truncate">{displayName(model)}</span>
                  {meta && (
                    <span className="flex items-center gap-1 flex-wrap">
                      {meta.count !== undefined && (
                        <Pill
                          style={{
                            backgroundColor: 'var(--color-pill-count-bg)',
                            color: 'var(--color-pill-count-text)',
                          }}
                        >
                          {meta.count}
                        </Pill>
                      )}
                      {meta.queued !== undefined && (
                        <Pill
                          style={{
                            backgroundColor: 'var(--color-pill-queued-bg)',
                            color: 'var(--color-pill-queued-text)',
                          }}
                        >
                          {meta.queued}
                        </Pill>
                      )}
                      {meta.eta !== undefined && (
                        <Pill
                          style={{
                            backgroundColor: 'var(--color-pill-eta-bg)',
                            color: 'var(--color-pill-eta-text)',
                          }}
                        >
                          {formatEta(meta.eta)}
                        </Pill>
                      )}
                      {meta.performance !== undefined && (
                        <Pill
                          style={{
                            backgroundColor: 'var(--color-pill-perf-bg)',
                            color: 'var(--color-pill-perf-text)',
                          }}
                        >
                          {meta.performance} tok/s
                        </Pill>
                      )}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ModelSelect({
  providerId,
  value,
  onChange,
  models = [],
  modelNames = {},
  modelMeta = {},
  onRefresh,
  fetching,
  onCancelFetch,
  cooldownRemaining,
}) {
  const { t } = useTranslation('settings')
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef(null)
  const [favModels, setFavModels] = useState([])
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (providerId) {
      getFavModels(providerId).then(setFavModels)
      getUIState(`modelSelect.${providerId}.sortBy`).then((val) => {
        if (val && SORT_OPTIONS.includes(val)) setSortBy(val)
      })
      getUIState(`modelSelect.${providerId}.sortOrder`).then((val) => {
        if (val === 'asc' || val === 'desc') setSortOrder(val)
      })
      getUIState(`modelSelect.${providerId}.filter`).then((val) => {
        if (val) setFilter(val)
      })
    }
  }, [providerId])

  useEffect(() => {
    if (cooldownRemaining > 0) {
      const seconds = Math.ceil(cooldownRemaining / 1000)
      setCountdown(seconds)
      clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            timerRef.current = null
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timerRef.current)
    } else {
      setCountdown(0)
    }
  }, [cooldownRemaining])

  function persistSortBy(val) {
    setSortBy(val)
    if (providerId) setUIState(`modelSelect.${providerId}.sortBy`, val)
  }

  function persistSortOrder(val) {
    setSortOrder(val)
    if (providerId) setUIState(`modelSelect.${providerId}.sortOrder`, val)
  }

  function persistFilter(val) {
    setFilter(val)
    if (providerId) setUIState(`modelSelect.${providerId}.filter`, val)
  }

  const processedModels = useMemo(() => {
    let list = [...new Set([...models])]
    const q = filter.toLowerCase().trim()
    if (q) {
      list = list.filter((m) => (modelNames[m] || m).toLowerCase().includes(q))
    }
    if (sortBy === 'name') {
      list.sort((a, b) => {
        const nameA = modelNames[a] || a
        const nameB = modelNames[b] || b
        return sortOrder === 'desc' ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB)
      })
    }
    return list
  }, [models, filter, sortBy, sortOrder, modelNames])

  async function handleToggleFav(modelName) {
    const updated = await toggleFavModel(providerId, modelName)
    setFavModels(updated)
  }

  const filterControl = providerId ? (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-secondary whitespace-nowrap">{t('api.modelSortBy')}</span>
        <select
          value={sortBy}
          onChange={(e) => persistSortBy(e.target.value)}
          className="min-h-[44px] px-3 py-2 text-sm bg-surface border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {SORT_OPTIONS.map((key) => (
            <option key={key} value={key}>
              {t(`api.modelSort.${key}`)}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => persistSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-3 border border-border rounded-md text-sm text-text hover:bg-surface-hover"
      >
        <ArrowUpDown className="w-4 h-4" />
        <span className="text-xs text-secondary">{t(`api.modelOrder.${sortOrder}`)}</span>
      </button>
    </div>
  ) : null

  return (
    <div className="space-y-2">
      {providerId && (
        <CollapsibleSection
          label={
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              {t('api.modelFilterSection')}
            </span>
          }
          summary={
            filter || sortBy !== 'name' || sortOrder !== 'asc' ? t('api.modelFilterActive') : ''
          }
          storageKey={`modelSelectFilter.${providerId}`}
          defaultExpanded={false}
        >
          <div className="pt-1 pb-2 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary pointer-events-none" />
              <input
                type="text"
                value={filter}
                onChange={(e) => persistFilter(e.target.value)}
                placeholder={t('api.modelSearchPlaceholder')}
                className="w-full min-h-[44px] pl-10 pr-10 text-sm bg-surface border border-border rounded-md text-text placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {filter && (
                <button
                  type="button"
                  onClick={() => persistFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {filterControl}
          </div>
        </CollapsibleSection>
      )}

      <ModelDropdown
        models={processedModels}
        modelNames={modelNames}
        modelMeta={modelMeta}
        value={value || ''}
        onChange={onChange}
        favModels={favModels}
        onToggleFav={handleToggleFav}
        selectLabel={t('api.selectModel')}
      />

      {fetching ? (
        <div className="flex items-center justify-between px-3 py-2 min-h-[44px] border border-border rounded-md">
          <span className="flex items-center gap-2 text-sm text-secondary">
            <RefreshCw className="w-4 h-4 animate-spin" />
            {t('api.fetchingModels')}
          </span>
          {onCancelFetch && (
            <button
              type="button"
              onClick={onCancelFetch}
              className="flex items-center gap-1 text-sm text-error hover:opacity-80 min-h-[44px] min-w-[44px] justify-center"
            >
              <X className="w-4 h-4" />
              {t('cancel', { ns: 'common' })}
            </button>
          )}
        </div>
      ) : countdown > 0 ? (
        <div className="flex items-center justify-center px-3 py-2 min-h-[44px] border border-border rounded-md">
          <span className="text-sm text-tertiary">{t('api.cooldown', { seconds: countdown })}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onRefresh?.(providerId)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] text-sm text-secondary hover:bg-surface-hover border border-border rounded-md"
        >
          <RefreshCw className="w-4 h-4" />
          {t('api.refreshModels')}
        </button>
      )}
    </div>
  )
}

export default ModelSelect
