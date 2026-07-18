import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../lib/confirm'
import ListManagementModal from './shared/ListManagementModal'
import Avatar from '../shared/Avatar'
import { FileText } from '../../lib/icons'
import {
  getAllWritingInstructions,
  deleteWritingInstruction,
  deleteWritingInstructions,
  duplicateWritingInstruction,
  duplicateWritingInstructions,
  exportWritingInstruction,
  exportWritingInstructions,
  importWritingInstructions,
  updateWritingInstructionOrder,
} from '../../services/writingInstructions'
import db from '../../db'

function WritingInstructionManagementModal() {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()

  const config = {
    entityKey: 'writingInstruction',
    changeEvent: 'writingInstructions-changed',
    showImage: false,
    icon: FileText,
    formModal: 'writingInstructionForm',
    formProp: 'writingInstruction',
    getTitle: (wi) => wi.name,
    confirmDelete: async (wi) => {
      const linked = (await db.characters.toArray()).filter((c) => c.writingInstruction === wi.id)
      const children =
        linked.length > 0 ? (
          <div className="mb-6">
            <p className="text-sm text-secondary mb-3">
              {t('writingInstruction.confirmDelete.linkedCharacters', { count: linked.length })}
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
        title: t('writingInstruction.confirmDelete.title'),
        message: t('writingInstruction.confirmDelete.message', { name: wi.name }),
        confirmLabel: t('writingInstruction.actions.delete'),
        cancelLabel: t('common:cancel'),
        variant: 'danger',
        children,
      })
      return { ok }
    },
    service: {
      getAll: getAllWritingInstructions,
      delete: deleteWritingInstruction,
      deleteMany: deleteWritingInstructions,
      duplicate: duplicateWritingInstruction,
      duplicateMany: duplicateWritingInstructions,
      exportOne: exportWritingInstruction,
      exportMany: exportWritingInstructions,
      importMany: importWritingInstructions,
      updateOrder: updateWritingInstructionOrder,
    },
  }

  return <ListManagementModal config={config} />
}

export default WritingInstructionManagementModal
