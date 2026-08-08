import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../lib/confirm'
import ListManagementModal from './shared/ListManagementModal'
import { ThreadRows, CompactBlock } from './shared/UsageWarning'
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
  getInChatShortcutUsage,
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
      const usage = await getInChatShortcutUsage([s.id])
      const children =
        usage.length > 0 ? (
          <ThreadRows
            title={t('inChatShortcut.confirmDelete.usedInThreads', {
              count: usage[0].threads.length,
            })}
            threads={usage[0].threads}
          />
        ) : null
      const ok = await confirm({
        title: t('inChatShortcut.confirmDelete.title'),
        message: t('inChatShortcut.confirmDelete.message', { name: s.name }),
        confirmLabel: t('inChatShortcut.actions.delete'),
        cancelLabel: t('common:cancel'),
        variant: 'danger',
        children,
      })
      return { ok }
    },
    confirmDeleteMany: async (items) => {
      const usage = await getInChatShortcutUsage(items.map((i) => i.id))
      if (usage.length === 0) return null
      return (
        <CompactBlock
          heading={t('inChatShortcut.confirmDelete.usedInThreadsMany')}
          lines={usage.map(
            (u) =>
              `${u.name} — ${t('inChatShortcut.confirmDelete.usedThreadsCount', {
                count: u.threads.length,
              })}`,
          )}
        />
      )
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
