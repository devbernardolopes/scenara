import { useTranslation } from 'react-i18next'

function PlaceholderSection() {
  const { t } = useTranslation('characterCreation')

  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-secondary text-sm">{t('comingSoon')}</p>
    </div>
  )
}

export default PlaceholderSection
