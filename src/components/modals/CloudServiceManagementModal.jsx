import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../lib/confirm'
import ListManagementModal from './shared/ListManagementModal'
import { Cloud } from '../../lib/icons'
import {
  getAllServices,
  deleteService,
  deleteServices,
  duplicateService,
  duplicateServices,
  exportService,
  exportServices,
  importServices,
  updateCloudServiceOrder,
  SERVICE_TYPES,
} from '../../services/cloudServices'

function CloudServiceManagementModal() {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()

  const config = {
    entityKey: 'cloudService',
    titleKey: 'cloudService.title',
    createLabelKey: 'cloudService.createService',
    importLabelKey: 'cloudService.importService',
    changeEvent: 'cloudServices-changed',
    showImage: false,
    formModal: 'cloudServiceForm',
    formProp: 'cloudService',
    icon: Cloud,
    getTile: () => (
      <div className="flex items-center justify-center size-[44px] shrink-0 rounded-md bg-primary-subtle">
        <Cloud className="w-5 h-5 text-primary" />
      </div>
    ),
    getTitle: (s) => s.name,
    getSubtitle: (s) => {
      const type = SERVICE_TYPES.find((t) => t.id === s.serviceType)
      return type ? t(type.nameKey.replace('settings:', '')) : s.serviceType
    },
    confirmDelete: async (s) => {
      const ok = await confirm({
        title: t('cloudService.confirmDelete.title'),
        message: t('cloudService.confirmDelete.message', { name: s.name }),
        confirmLabel: t('cloudService.actions.delete'),
        cancelLabel: t('common:cancel'),
        variant: 'danger',
      })
      return { ok }
    },
    service: {
      getAll: getAllServices,
      delete: deleteService,
      deleteMany: deleteServices,
      duplicate: duplicateService,
      duplicateMany: duplicateServices,
      exportOne: exportService,
      exportMany: exportServices,
      importMany: importServices,
      updateOrder: updateCloudServiceOrder,
    },
  }

  return <ListManagementModal config={config} />
}

export default CloudServiceManagementModal
