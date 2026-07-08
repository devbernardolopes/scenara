import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, X, ChevronDown, Star } from '../../../../lib/icons'
import { getFavModels, toggleFavModel } from '../../../../services/apiProviders'

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

function HordeDropdown({
  models,
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface text-text text-sm text-left flex items-center gap-2"
      >
        <span className={`flex-1 truncate ${value ? '' : 'text-tertiary'}`}>
          {value || selectLabel}
        </span>
        {selectedMeta && (
          <span className="flex items-center gap-1 shrink-0">
            <Pill className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {selectedMeta.count}
            </Pill>
            <Pill className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
              {selectedMeta.queued}
            </Pill>
            <Pill className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              {formatEta(selectedMeta.eta)}
            </Pill>
            <Pill className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              {selectedMeta.performance} tok/s
            </Pill>
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 border border-border rounded-md bg-surface shadow-surface-lg max-h-72 overflow-y-auto">
          <div
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-tertiary hover:bg-surface-hover cursor-pointer min-h-[44px]"
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
          >
            {selectLabel}
          </div>
          {models.map((model) => {
            const meta = modelMeta[model]
            const isFav = favModels.includes(model)
            return (
              <div
                key={model}
                className={`flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer min-h-[44px] ${
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
                  className="shrink-0 focus:outline-none"
                >
                  <Star
                    className={`w-4 h-4 ${
                      isFav
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-tertiary hover:text-yellow-400'
                    }`}
                  />
                </button>
                <span className="flex-1 truncate">{model}</span>
                {meta && (
                  <span className="flex items-center gap-1 shrink-0">
                    <Pill className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                      {meta.count}
                    </Pill>
                    <Pill className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                      {meta.queued}
                    </Pill>
                    <Pill className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      {formatEta(meta.eta)}
                    </Pill>
                    <Pill className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                      {meta.performance} tok/s
                    </Pill>
                  </span>
                )}
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
  const isHorde = providerId === 'ai-horde'

  useEffect(() => {
    if (isHorde) {
      getFavModels(providerId).then(setFavModels)
    }
  }, [providerId, isHorde])

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

  async function handleToggleFav(modelName) {
    const updated = await toggleFavModel(providerId, modelName)
    setFavModels(updated)
  }

  return (
    <div className="space-y-2">
      {isHorde ? (
        <HordeDropdown
          models={[...new Set([...models])]}
          modelMeta={modelMeta}
          value={value || ''}
          onChange={onChange}
          favModels={favModels}
          onToggleFav={handleToggleFav}
          selectLabel={t('api.selectModel')}
        />
      ) : (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface text-text text-sm"
        >
          <option value="">{t('api.selectModel')}</option>
          {[...new Set([...models])].map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      )}

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
