import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import ProfileSettingsPanel from './settings/ProfileSettingsPanel'
import CloseButton from '../shared/CloseButton'

function ProfileManagementModal() {
  const { closeModal } = useModal()
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 border-b border-border shrink-0">
        <h2 className="text-xl font-semibold text-text">{t('sidebar.connectionProfiles')}</h2>
        <CloseButton onClick={closeModal} />
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <ProfileSettingsPanel />
      </div>
    </div>
  )
}

export default ProfileManagementModal
