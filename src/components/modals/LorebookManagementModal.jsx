import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../lib/confirm'
import ListManagementModal from './shared/ListManagementModal'
import {
  getAllLorebooks,
  deleteLorebook,
  deleteLorebooks,
  duplicateLorebook,
  duplicateLorebooks,
  exportLorebook,
  exportLorebooks,
  importLorebooks,
  updateLorebookOrder,
} from '../../services/lorebooks'

function LorebookManagementModal() {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()

  const config = {
    entityKey: 'lorebook',
    importLabelKey: 'lorebook.importLabel',
    changeEvent: 'lorebooks-changed',
    showImage: true,
    squaredImage: true,
    canCreate: false,
    comingSoonNoteKey: 'lorebook.comingSoon',
    formModal: null,
    formProp: 'lorebook',
    getTitle: (l) => l.name,
    getImageSrc: (l) => l.avatar,
    confirmDelete: async (l) => {
      const ok = await confirm({
        title: t('lorebook.confirmDelete.title'),
        message: t('lorebook.confirmDelete.message', { name: l.name }),
        confirmLabel: t('lorebook.actions.delete'),
        cancelLabel: t('common:cancel'),
        variant: 'danger',
      })
      return { ok }
    },
    service: {
      getAll: getAllLorebooks,
      delete: deleteLorebook,
      deleteMany: deleteLorebooks,
      duplicate: duplicateLorebook,
      duplicateMany: duplicateLorebooks,
      exportOne: exportLorebook,
      exportMany: exportLorebooks,
      importMany: importLorebooks,
      updateOrder: updateLorebookOrder,
    },
  }

  return <ListManagementModal config={config} />
}

export default LorebookManagementModal
