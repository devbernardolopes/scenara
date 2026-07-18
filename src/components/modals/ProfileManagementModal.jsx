import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../lib/confirm'
import ListManagementModal from './shared/ListManagementModal'
import ProviderIcon from '../shared/ProviderIcon'
import {
  getAllProfiles,
  deleteProfile,
  deleteProfiles,
  duplicateProfile,
  duplicateProfiles,
  exportProfile,
  exportProfiles,
  importProfiles,
  updateConnectionProfileOrder,
  REQUEST_KINDS,
} from '../../services/connectionProfiles'
import { PROVIDERS } from '../../services/apiProviders'
import { getSetting } from '../../services/settings'

function ProfileManagementModal() {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()

  const config = {
    entityKey: 'api.profile',
    titleKey: 'sidebar.connectionProfiles',
    changeEvent: 'connectionProfiles-changed',
    showImage: false,
    formModal: 'profileForm',
    formProp: 'profile',
    getTile: (p) => (
      <div className="flex items-center justify-center size-[44px] shrink-0 rounded-md bg-primary-subtle">
        <ProviderIcon providerId={p.providerId} size={24} />
      </div>
    ),
    getTitle: (p) => p.name,
    getSubtitle: (p) => {
      const provider = PROVIDERS.find((pr) => pr.id === p.providerId)
      const base = provider ? t(provider.nameKey.replace('settings:', '')) : p.providerId
      return p.model ? `${base} · ${p.model}` : base
    },
    confirmDelete: async (p) => {
      const assignedKinds = []
      for (const kind of REQUEST_KINDS) {
        const assignedId = await getSetting(`requestKind.${kind}.profileId`)
        if (assignedId === p.id) assignedKinds.push(kind)
      }
      const children =
        assignedKinds.length > 0 ? (
          <div className="text-sm text-secondary mb-4">
            <p>{t('api.profile.confirmDelete.assignedTo')}</p>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              {assignedKinds.map((kind) => (
                <li key={kind}>{t(`api.${kind}Profile.label`)}</li>
              ))}
            </ul>
          </div>
        ) : null
      const ok = await confirm({
        title: t('api.profile.confirmDelete.title'),
        message: t('api.profile.confirmDelete.message', { name: p.name }),
        confirmLabel: t('api.profile.actions.delete'),
        cancelLabel: t('common:cancel'),
        variant: 'danger',
        children,
      })
      return { ok }
    },
    service: {
      getAll: getAllProfiles,
      delete: deleteProfile,
      deleteMany: deleteProfiles,
      duplicate: duplicateProfile,
      duplicateMany: duplicateProfiles,
      exportOne: exportProfile,
      exportMany: exportProfiles,
      importMany: importProfiles,
      updateOrder: updateConnectionProfileOrder,
    },
  }

  return <ListManagementModal config={config} />
}

export default ProfileManagementModal
