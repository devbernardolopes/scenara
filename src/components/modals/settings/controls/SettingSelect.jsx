import { useTranslation } from 'react-i18next'

function SettingSelect({ value, options, optionLabels, onChange }) {
  const { t } = useTranslation('settings')

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            value === opt
              ? 'bg-primary text-on-primary border-primary'
              : 'bg-surface text-secondary border-border hover:bg-surface-hover'
          }`}
        >
          {optionLabels?.[opt] ? t(optionLabels[opt].replace('settings:', '')) : opt}
        </button>
      ))}
    </div>
  )
}

export default SettingSelect
