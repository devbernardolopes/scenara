import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../lib/confirm'
import ListManagementModal from './shared/ListManagementModal'
import { CharacterRows, CompactBlock } from './shared/UsageWarning'
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
  getWritingInstructionUsage,
} from '../../services/writingInstructions'

function WritingInstructionManagementModal() {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()

  const config = {
    entityKey: 'writingInstruction',
    createLabelKey: 'writingInstruction.createWritingInstruction',
    importLabelKey: 'writingInstruction.importWritingInstruction',
    changeEvent: 'writingInstructions-changed',
    showImage: false,
    icon: FileText,
    formModal: 'writingInstructionForm',
    formProp: 'writingInstruction',
    getTitle: (wi) => wi.name,
    confirmDelete: async (wi) => {
      const usage = await getWritingInstructionUsage([wi.id])
      const children =
        usage.length > 0 ? (
          <CharacterRows
            title={t('writingInstruction.confirmDelete.linkedCharacters', {
              count: usage[0].characters.length,
            })}
            characters={usage[0].characters}
          />
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
    confirmDeleteMany: async (items) => {
      const usage = await getWritingInstructionUsage(items.map((i) => i.id))
      if (usage.length === 0) return null
      return (
        <CompactBlock
          heading={t('writingInstruction.confirmDelete.linkedCharactersMany')}
          lines={usage.map(
            (u) =>
              `${u.name} — ${t('writingInstruction.confirmDelete.linkedCharactersCount', {
                count: u.characters.length,
              })}`,
          )}
        />
      )
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
