import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../lib/confirm'
import ListManagementModal from './shared/ListManagementModal'
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
      const ok = await confirm({
        title: t('persona.confirmDelete.title'),
        message: t('persona.confirmDelete.message', { name: p.name }),
        confirmLabel: t('persona.actions.delete'),
        cancelLabel: t('common:cancel'),
        variant: 'danger',
      })
      return { ok }
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
