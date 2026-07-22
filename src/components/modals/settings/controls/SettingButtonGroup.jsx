import { useTranslation } from 'react-i18next'

function SettingButtonGroup({ value, onChange, disabled, buttons = [] }) {
  const { t } = useTranslation('settings')

  if (buttons.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 min-h-[44px] items-center">
      {buttons.map((btn) => {
        const val = btn.value ?? btn.key
        const label = btn.labelKey ? t(btn.labelKey.replace('settings:', '')) : val
        return (
          <button
            key={val}
            type="button"
            onClick={() => !disabled && onChange(val)}
            disabled={disabled}
            className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              disabled
                ? 'bg-surface text-tertiary border-border cursor-not-allowed'
                : value === val
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface bg-surface-secondary text-secondary border-border hover:bg-surface-hover'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default SettingButtonGroup
