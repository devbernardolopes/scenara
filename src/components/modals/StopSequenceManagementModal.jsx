import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../lib/confirm'
import ListManagementModal from './shared/ListManagementModal'
import { Tags } from '../../lib/icons'
import {
  getAllStopSequences,
  deleteStopSequence,
  deleteStopSequences,
  duplicateStopSequence,
  duplicateStopSequences,
  exportStopSequence,
  exportStopSequences,
  importStopSequences,
  updateStopSequenceOrder,
} from '../../services/stopSequences'

function StopSequenceManagementModal() {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()

  const config = {
    entityKey: 'stopSequence',
    changeEvent: 'stopSequences-changed',
    showImage: false,
    icon: Tags,
    formModal: 'stopSequenceForm',
    formProp: 'stopSequence',
    getTitle: (s) => s.name,
    getSubtitle: (s) => t('stopSequence.sequenceCount', { count: (s.sequences || []).length }),
    confirmDelete: async (s) => {
      const ok = await confirm({
        title: t('stopSequence.confirmDelete.title'),
        message: t('stopSequence.confirmDelete.message', { name: s.name }),
        confirmLabel: t('stopSequence.actions.delete'),
        cancelLabel: t('common:cancel'),
        variant: 'danger',
      })
      return { ok }
    },
    service: {
      getAll: getAllStopSequences,
      delete: deleteStopSequence,
      deleteMany: deleteStopSequences,
      duplicate: duplicateStopSequence,
      duplicateMany: duplicateStopSequences,
      exportOne: exportStopSequence,
      exportMany: exportStopSequences,
      importMany: importStopSequences,
      updateOrder: updateStopSequenceOrder,
    },
  }

  return <ListManagementModal config={config} />
}

export default StopSequenceManagementModal
