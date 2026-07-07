import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, X } from '../../../../lib/icons'

function ModelSelect({
  providerId,
  value,
  onChange,
  models = [],
  onRefresh,
  fetching,
  onCancelFetch,
  cooldownRemaining,
}) {
  const { t } = useTranslation('settings')
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef(null)

  const allModels = [...new Set([...models])]

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

  return (
    <div className="space-y-2">
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface text-text text-sm"
      >
        <option value="">{t('api.selectModel')}</option>
        {allModels.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>

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
