import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../lib/confirm'
import ListManagementModal from './shared/ListManagementModal'
import { SlidersHorizontal } from '../../lib/icons'
import {
  getAllSamplingProfiles,
  deleteSamplingProfile,
  deleteSamplingProfiles,
  duplicateSamplingProfile,
  duplicateSamplingProfiles,
  exportSamplingProfile,
  exportSamplingProfiles,
  importSamplingProfiles,
  updateSamplingProfileOrder,
} from '../../services/samplingProfiles'

function SamplingProfileManagementModal() {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()

  const config = {
    entityKey: 'samplingProfile',
    changeEvent: 'samplingProfiles-changed',
    showImage: false,
    icon: SlidersHorizontal,
    formModal: 'samplingProfileForm',
    formProp: 'samplingProfile',
    getTitle: (sp) => sp.name,
    getSubtitle: (sp) =>
      t('samplingProfile.paramCount', { count: Object.keys(sp.params || {}).length }),
    confirmDelete: async (sp) => {
      const ok = await confirm({
        title: t('samplingProfile.confirmDelete.title'),
        message: t('samplingProfile.confirmDelete.message', { name: sp.name }),
        confirmLabel: t('samplingProfile.actions.delete'),
        cancelLabel: t('common:cancel'),
        variant: 'danger',
      })
      return { ok }
    },
    service: {
      getAll: getAllSamplingProfiles,
      delete: deleteSamplingProfile,
      deleteMany: deleteSamplingProfiles,
      duplicate: duplicateSamplingProfile,
      duplicateMany: duplicateSamplingProfiles,
      exportOne: exportSamplingProfile,
      exportMany: exportSamplingProfiles,
      importMany: importSamplingProfiles,
      updateOrder: updateSamplingProfileOrder,
    },
  }

  return <ListManagementModal config={config} />
}

export default SamplingProfileManagementModal
