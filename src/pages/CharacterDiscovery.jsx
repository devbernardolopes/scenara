import { useTranslation } from 'react-i18next'
import { useModal } from '../hooks/useModal'

function CharacterDiscovery() {
  const { t } = useTranslation('common')
  const { openModal } = useModal()

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-text mb-2">{t('discovery.title')}</h1>
      <p className="text-secondary mb-6">{t('discovery.subtitle')}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="border border-border rounded-lg p-4 hover:shadow-surface-md transition-shadow cursor-pointer bg-surface"
          >
            <h3 className="font-semibold text-text">{t('discovery.characterCard', { index: i })}</h3>
            <p className="text-sm text-secondary mt-1">{t('discovery.characterDesc')}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => openModal('characterCreate')}
        className="mt-6 px-4 py-2 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm"
      >
        {t('discovery.createCharacter')}
      </button>
    </div>
  )
}

export default CharacterDiscovery
