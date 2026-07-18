import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../lib/confirm'
import ListManagementModal from './shared/ListManagementModal'
import { Zap } from '../../lib/icons'
import {
  getAllInChatShortcuts,
  deleteInChatShortcut,
  deleteInChatShortcuts,
  duplicateInChatShortcut,
  duplicateInChatShortcuts,
  exportInChatShortcut,
  exportInChatShortcuts,
  importInChatShortcuts,
  updateInChatShortcutOrder,
} from '../../services/inChatShortcuts'

function InChatShortcutManagementModal() {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()

  const config = {
    entityKey: 'inChatShortcut',
    importLabelKey: 'inChatShortcut.importLabel',
    changeEvent: 'inChatShortcuts-changed',
    showImage: false,
    icon: Zap,
    formModal: 'inChatShortcutForm',
    formProp: 'inChatShortcut',
    getTitle: (s) => s.name,
    confirmDelete: async (s) => {
      const ok = await confirm({
        title: t('inChatShortcut.confirmDelete.title'),
        message: t('inChatShortcut.confirmDelete.message', { name: s.name }),
        confirmLabel: t('inChatShortcut.actions.delete'),
        cancelLabel: t('common:cancel'),
        variant: 'danger',
      })
      return { ok }
    },
    service: {
      getAll: getAllInChatShortcuts,
      delete: deleteInChatShortcut,
      deleteMany: deleteInChatShortcuts,
      duplicate: duplicateInChatShortcut,
      duplicateMany: duplicateInChatShortcuts,
      exportOne: exportInChatShortcut,
      exportMany: exportInChatShortcuts,
      importMany: importInChatShortcuts,
      updateOrder: updateInChatShortcutOrder,
    },
  }

  return <ListManagementModal config={config} />
}

export default InChatShortcutManagementModal
