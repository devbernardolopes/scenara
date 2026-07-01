import { useTranslation } from 'react-i18next'
import { Search } from '../../../lib/icons'

function SettingsSearch({ value, onChange }) {
  const { t } = useTranslation('settings')

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="w-full pl-9 pr-3 min-h-[44px] border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm"
      />
    </div>
  )
}

export default SettingsSearch
