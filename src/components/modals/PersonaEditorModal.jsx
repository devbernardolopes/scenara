import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'

function PersonaEditorModal() {
  const { t } = useTranslation('characterCreation')
  const { closeModal } = useModal()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text">{t('personaTitle')}</h2>
        <button
          onClick={closeModal}
          className="text-tertiary hover:text-text"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <p className="text-secondary text-sm">{t('personaPlaceholder')}</p>
    </div>
  )
}

export default PersonaEditorModal
