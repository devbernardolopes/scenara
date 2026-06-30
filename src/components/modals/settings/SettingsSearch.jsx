import { useTranslation } from 'react-i18next'

function SettingsSearch({ value, onChange }) {
  const { t } = useTranslation('settings')

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t('searchPlaceholder')}
      className="w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm"
    />
  )
}

export default SettingsSearch
