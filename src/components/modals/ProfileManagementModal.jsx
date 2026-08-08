import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../lib/confirm'
import ListManagementModal from './shared/ListManagementModal'
import { CompactBlock } from './shared/UsageWarning'
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
  getProfileUsage,
} from '../../services/connectionProfiles'
import { PROVIDERS } from '../../services/apiProviders'

function ProfileManagementModal() {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()

  function kindLabel(kind) {
    return t(`api.${kind}Profile.label`)
  }

  function overridesLine(override) {
    return override.characters
      .map((c) => `${c.name} (${c.kinds.map(kindLabel).join(', ')})`)
      .join(', ')
  }

  const config = {
    entityKey: 'api.profile',
    titleKey: 'common:sidebar.connectionProfiles',
    createLabelKey: 'api.profile.createProfile',
    importLabelKey: 'api.profile.importProfile',
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
      const { assignments, overrides } = await getProfileUsage([p.id])
      const children = []
      if (assignments.length > 0) {
        children.push(
          <div className="text-sm text-secondary mb-4">
            <p>{t('api.profile.confirmDelete.assignedTo')}</p>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              {assignments[0].kinds.map((kind) => (
                <li key={kind}>{kindLabel(kind)}</li>
              ))}
            </ul>
          </div>,
        )
      }
      if (overrides.length > 0) {
        children.push(
          <div className="text-sm text-secondary mb-4">
            <p>{t('api.profile.confirmDelete.usedByCharacters')}</p>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              {overrides[0].characters.map((char) => (
                <li key={char.id}>
                  {char.name} — {char.kinds.map(kindLabel).join(', ')}
                </li>
              ))}
            </ul>
          </div>,
        )
      }
      const ok = await confirm({
        title: t('api.profile.confirmDelete.title'),
        message: t('api.profile.confirmDelete.message', { name: p.name }),
        confirmLabel: t('api.profile.actions.delete'),
        cancelLabel: t('common:cancel'),
        variant: 'danger',
        children: children.length > 0 ? children : null,
      })
      return { ok }
    },
    confirmDeleteMany: async (items) => {
      const { assignments, overrides } = await getProfileUsage(items.map((i) => i.id))
      const blocks = []
      if (assignments.length > 0) {
        blocks.push(
          <CompactBlock
            key="assignments"
            heading={t('api.profile.confirmDelete.assignedToMany')}
            lines={assignments.map((a) => `${a.name} — ${a.kinds.map(kindLabel).join(', ')}`)}
          />,
        )
      }
      if (overrides.length > 0) {
        blocks.push(
          <CompactBlock
            key="overrides"
            heading={t('api.profile.confirmDelete.usedByCharactersMany')}
            lines={overrides.map((o) => `${o.name} — ${overridesLine(o)}`)}
          />,
        )
      }
      return blocks.length > 0 ? blocks : null
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
