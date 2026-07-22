import { useTranslation } from 'react-i18next'

function SettingsSidebar({ categories, active, onSelect }) {
  const { t } = useTranslation('settings')

  return (
    <nav className="w-44 shrink-0 shadow-sidebar overflow-y-auto px-4 py-4 hidden md:block">
      <ul className="space-y-1">
        {categories.map((cat) => (
          <li key={cat.id}>
            <button
              onClick={() => onSelect(cat.id)}
              className={`w-full text-left px-3 min-h-[44px] rounded-md text-sm ${
                active === cat.id
                  ? 'bg-primary-subtle text-primary font-medium'
                  : 'text-secondary hover:bg-surface-hover'
              }`}
            >
              {t(cat.labelKey.replace('settings:', ''))}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default SettingsSidebar
