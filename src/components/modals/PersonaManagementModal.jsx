import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../lib/confirm'
import ListManagementModal from './shared/ListManagementModal'
import { ThreadRows, CompactBlock } from './shared/UsageWarning'
import {
  getAllPersonas,
  deletePersona,
  deletePersonas,
  duplicatePersona,
  duplicatePersonas,
  setDefaultPersona,
  exportPersona,
  exportPersonas,
  importPersonas,
  updatePersonaOrder,
  getPersonaUsage,
} from '../../services/personas'

function PersonaManagementModal() {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()

  const config = {
    entityKey: 'persona',
    createLabelKey: 'persona.createPersona',
    importLabelKey: 'persona.importPersona',
    changeEvent: 'personas-changed',
    showImage: true,
    squaredImage: true,
    showSetDefault: true,
    formModal: 'personaForm',
    formProp: 'persona',
    getTitle: (p) => p.name,
    getSubtitle: (p) => p.title || null,
    getDescription: (p) => p.description || null,
    getImageSrc: (p) => p.avatar,
    getBadges: (p) =>
      p.isDefault ? (
        <span className="text-xs bg-primary-subtle text-primary px-1.5 py-0.5 rounded font-medium">
          {t('persona.defaultBadge')}
        </span>
      ) : null,
    isDefault: (p) => !!p.isDefault,
    onSetDefault: (p) => setDefaultPersona(p.id),
    disableDelete: (p, all) => all.length <= 1,
    confirmDelete: async (p) => {
      const usage = await getPersonaUsage([p.id])
      const children =
        usage.length > 0 ? (
          <ThreadRows
            title={t('persona.confirmDelete.usedInThreads', { count: usage[0].threads.length })}
            threads={usage[0].threads}
          />
        ) : null
      const ok = await confirm({
        title: t('persona.confirmDelete.title'),
        message: t('persona.confirmDelete.message', { name: p.name }),
        confirmLabel: t('persona.actions.delete'),
        cancelLabel: t('common:cancel'),
        variant: 'danger',
        children,
      })
      return { ok }
    },
    confirmDeleteMany: async (items) => {
      const usage = await getPersonaUsage(items.map((i) => i.id))
      if (usage.length === 0) return null
      return (
        <CompactBlock
          heading={t('persona.confirmDelete.usedInThreadsMany')}
          lines={usage.map(
            (u) =>
              `${u.name} — ${t('persona.confirmDelete.usedThreadsCount', {
                count: u.threads.length,
              })}`,
          )}
        />
      )
    },
    service: {
      getAll: getAllPersonas,
      delete: deletePersona,
      deleteMany: deletePersonas,
      duplicate: duplicatePersona,
      duplicateMany: duplicatePersonas,
      exportOne: exportPersona,
      exportMany: exportPersonas,
      importMany: importPersonas,
      updateOrder: updatePersonaOrder,
    },
  }

  return <ListManagementModal config={config} />
}

export default PersonaManagementModal
