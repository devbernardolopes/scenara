import { useTranslation } from 'react-i18next'
import { X } from '../../lib/icons'

function CloseButton({ onClick, label }) {
  const { t } = useTranslation('common')
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
      aria-label={label || t('close')}
    >
      <X className="w-5 h-5" />
    </button>
  )
}

export default CloseButton
