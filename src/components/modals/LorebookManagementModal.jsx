import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../lib/confirm'
import ListManagementModal from './shared/ListManagementModal'
import Avatar from '../shared/Avatar'
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
import db from '../../db'

function LorebookManagementModal() {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()

  const config = {
    entityKey: 'lorebook',
    importLabelKey: 'lorebook.importLabel',
    changeEvent: 'lorebooks-changed',
    showImage: true,
    squaredImage: true,
    canCreate: true,
    formModal: 'lorebookForm',
    formProp: 'lorebook',
    getTitle: (l) => l.name,
    getDescription: (l) => l.description || null,
    getBadges: (l) =>
      l.isGlobal ? (
        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary-subtle text-primary">
          {t('lorebook.globalBadge')}
        </span>
      ) : null,
    getImageSrc: (l) => l.avatar,
    confirmDelete: async (l) => {
      const linked = (await db.characters.toArray()).filter((c) =>
        (c.lorebookIds || []).includes(l.id),
      )
      const children =
        linked.length > 0 ? (
          <div className="mb-6">
            <p className="text-sm text-secondary mb-3">
              {t('lorebook.confirmDelete.linkedCharacters', { count: linked.length })}
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {linked.map((char) => (
                <div
                  key={char.id}
                  className="flex items-center gap-3 p-2 rounded-md bg-surface-secondary"
                >
                  <Avatar src={char.avatar} size="md" />
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm font-medium text-text truncate">{char.name}</span>
                    <span className="text-xs text-tertiary shrink-0">#{char.characterNumber}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null
      const ok = await confirm({
        title: t('lorebook.confirmDelete.title'),
        message: t('lorebook.confirmDelete.message', { name: l.name }),
        confirmLabel: t('lorebook.actions.delete'),
        cancelLabel: t('common:cancel'),
        variant: 'danger',
        children,
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
