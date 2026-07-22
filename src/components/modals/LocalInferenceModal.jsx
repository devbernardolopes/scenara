import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import CloseButton from '../shared/CloseButton'
import { Brain } from '../../lib/icons'

function LocalInferenceModal() {
  const { t } = useTranslation('common')
  const { closeModal } = useModal()

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 shadow-section shrink-0">
        <h2 className="text-xl font-semibold text-text">{t('sidebar.localInference')}</h2>
        <CloseButton onClick={closeModal} />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-4">
        <Brain className="w-10 h-10 text-tertiary" />
        <p className="text-secondary text-sm text-center">{t('localInference.placeholder')}</p>
      </div>
    </div>
  )
}

export default LocalInferenceModal
