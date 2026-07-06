import { useTranslation } from 'react-i18next'
import { ChevronUp, ChevronDown } from '../../../../lib/icons'

function SettingButtonOrder({ value = [], onChange, disabled, buttons = [] }) {
  const { t } = useTranslation('settings')

  if (buttons.length === 0) return null

  const ordered = buttons.slice().sort((a, b) => {
    const ia = value.indexOf(a.key)
    const ib = value.indexOf(b.key)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })

  function moveUp(index) {
    if (index === 0) return
    const next = [...ordered.map((b) => b.key)]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    onChange(next)
  }

  function moveDown(index) {
    if (index === ordered.length - 1) return
    const next = [...ordered.map((b) => b.key)]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    onChange(next)
  }

  return (
    <div className="space-y-1">
      {ordered.map((btn, index) => (
        <div
          key={btn.key}
          className="flex items-center gap-1 min-h-[44px] px-2 rounded-md bg-surface-secondary border border-border"
        >
          <span className="flex-1 text-sm text-text min-w-0 truncate">
            {t(btn.labelKey.replace('settings:', ''))}
          </span>
          <button
            type="button"
            onClick={() => moveUp(index)}
            disabled={disabled || index === 0}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-surface-hover text-tertiary hover:text-text disabled:opacity-30 disabled:pointer-events-none"
            aria-label={t('moveUp', { ns: 'common' })}
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => moveDown(index)}
            disabled={disabled || index === ordered.length - 1}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-surface-hover text-tertiary hover:text-text disabled:opacity-30 disabled:pointer-events-none"
            aria-label={t('moveDown', { ns: 'common' })}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

export default SettingButtonOrder
