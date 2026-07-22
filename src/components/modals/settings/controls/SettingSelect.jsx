import { useTranslation } from 'react-i18next'

function SettingSelect({ value, options, optionLabels, onChange, disabled }) {
  const { t } = useTranslation('settings')

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => !disabled && onChange(opt)}
          disabled={disabled}
          className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            disabled
              ? 'bg-surface text-tertiary border-border cursor-not-allowed'
              : value === opt
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface bg-surface-secondary text-secondary border-border hover:bg-surface-hover'
          }`}
        >
          {optionLabels?.[opt] ? t(optionLabels[opt].replace('settings:', '')) : opt}
        </button>
      ))}
    </div>
  )
}

export default SettingSelect
