import { useTranslation } from 'react-i18next'
import { useModal } from '../../../../hooks/useModal'

function SettingManageEntities({ modal, disabled }) {
  const { t } = useTranslation('settings')
  const { openModal } = useModal()

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => openModal(modal)}
      className="min-h-[44px] px-4 text-sm btn-primary disabled:opacity-50"
    >
      {t('common:manage')}
    </button>
  )
}

export default SettingManageEntities
