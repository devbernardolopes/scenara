import { useTranslation } from 'react-i18next'

function SettingSelect({ value, options, optionLabels, onChange }) {
  const { t } = useTranslation('settings')

  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
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
