import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../../hooks/useModal'
import { CATEGORIES, SETTINGS, setSetting } from '../../../services/settings'
import SettingsSidebar from './SettingsSidebar'
import SettingsSearch from './SettingsSearch'
import SettingRow from './SettingRow'

function SettingsModal() {
  const { closeModal } = useModal()
  const { t } = useTranslation('settings')
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]?.id)
  const [search, setSearch] = useState('')

  const filtered = SETTINGS.filter((s) => {
    const matchesCategory = search ? true : s.category === activeCategory
    if (!matchesCategory) return false
    if (!search) return true
    const label = t(s.labelKey).toLowerCase()
    const desc = s.descKey ? t(s.descKey).toLowerCase() : ''
    const q = search.toLowerCase()
    return label.includes(q) || desc.includes(q)
  })

  const noResults = search && filtered.length === 0

  return (
    <div className="flex flex-col h-[80vh]">
      <div className="flex items-center justify-between p-6 pb-4 border-b border-border shrink-0">
        <h2 className="text-xl font-semibold text-text">{t('title')}</h2>
        <button onClick={closeModal} className="text-tertiary hover:text-text" aria-label="Close">
          ✕
        </button>
      </div>

      <div className="px-6 pt-4 pb-2 shrink-0">
        <SettingsSearch value={search} onChange={setSearch} />
      </div>

      <div className="flex flex-1 min-h-0">
        {!search && (
          <SettingsSidebar
            categories={CATEGORIES}
            active={activeCategory}
            onSelect={setActiveCategory}
          />
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {noResults ? (
            <p className="text-secondary text-sm">{t('noResults')}</p>
          ) : (
            <div className="space-y-6">
              {filtered.map((setting) => (
                <SettingRow key={setting.key} setting={setting} onSave={(v) => setSetting(setting.key, v)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
