import ListManagementModal from './shared/ListManagementModal'
import { FileText } from '../../lib/icons'
import {
  getAllPromptBankEntries,
  deletePromptBankEntry,
  deletePromptBankEntries,
  duplicatePromptBankEntry,
  duplicatePromptBankEntries,
  exportPromptBankEntry,
  exportPromptBankEntries,
  importPromptBankEntries,
  updatePromptBankOrder,
} from '../../services/promptBank'

function PromptBankManagementModal() {
  const config = {
    entityKey: 'promptBank',
    createLabelKey: 'promptBank.createEntry',
    importLabelKey: 'promptBank.importEntry',
    changeEvent: 'promptBank-changed',
    showImage: false,
    icon: FileText,
    formModal: 'promptBankForm',
    formProp: 'promptBankEntry',
    getTitle: (entry) => entry.name,
    getSubtitle: (entry) => entry.kind || null,
    getBadges: (entry) => {
      if (!entry.kind) return null
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-subtle text-primary">
          {entry.kind}
        </span>
      )
    },
    service: {
      getAll: getAllPromptBankEntries,
      delete: deletePromptBankEntry,
      deleteMany: deletePromptBankEntries,
      duplicate: duplicatePromptBankEntry,
      duplicateMany: duplicatePromptBankEntries,
      exportOne: exportPromptBankEntry,
      exportMany: exportPromptBankEntries,
      importMany: importPromptBankEntries,
      updateOrder: updatePromptBankOrder,
    },
  }

  return <ListManagementModal config={config} />
}

export default PromptBankManagementModal
