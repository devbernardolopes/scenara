import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { isExternalImageUrl } from '../../lib/image'
import IconButton from './IconButton'
import DragHandle from './DragHandle'
import { Edit3, Star, Copy, Download, Trash2 } from '../../lib/icons'

function ListEntryCard({
  item,
  title,
  subtitle,
  badges = [],
  imageSrc,
  icon: Icon,
  tile,
  selected,
  onToggleSelect,
  onEdit,
  showSetDefault,
  isDefault,
  onSetDefault,
  onDuplicate,
  onExport,
  onDelete,
  disableDelete,
  setNodeRef,
  style,
  dragHandleProps,
}) {
  const { t } = useTranslation('settings')
  const { openModal } = useModal()
  const online = useOnlineStatus()

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg p-3 bg-surface transition-shadow cursor-pointer ${
        selected ? 'border-primary ring-1 ring-primary' : 'border-border'
      }`}
      onClick={() => onEdit(item)}
    >
      <div className="flex items-start gap-3">
        <label
          className="flex items-center min-h-[44px] min-w-[44px] cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(item.id)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
        </label>

        {tile ? (
          tile
        ) : Icon ? (
          <div className="flex items-center justify-center size-[44px] shrink-0 rounded-md bg-primary-subtle">
            <Icon size={24} className="text-primary" />
          </div>
        ) : (
          <div
            className="flex items-center justify-center size-[44px] shrink-0 rounded-md bg-primary-subtle overflow-hidden cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              if (imageSrc) openModal('imageViewer', { src: imageSrc, modalSize: 'fullscreen' })
            }}
          >
            {imageSrc &&
            (imageSrc.startsWith('data:image/') || (isExternalImageUrl(imageSrc) && online)) ? (
              <img src={imageSrc} alt="" className="size-[44px] object-cover rounded-md" />
            ) : (
              <span className="text-2xl leading-none">{imageSrc || '👤'}</span>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-text truncate">{title}</span>
            {badges}
          </div>
          {subtitle ? <p className="text-xs text-secondary mt-0.5">{subtitle}</p> : null}
        </div>
      </div>

      <div className="flex items-center gap-1 mt-1 -ml-1">
        <IconButton
          icon={Edit3}
          label={t('common:list.actions.edit')}
          onClick={() => onEdit(item)}
        />
        {showSetDefault ? (
          <IconButton
            icon={Star}
            label={t('common:list.actions.setDefault')}
            onClick={() => onSetDefault(item)}
            className={isDefault ? 'hover:bg-surface-hover' : ''}
            iconClassName={isDefault ? 'fill-yellow-500 text-yellow-500' : ''}
          />
        ) : null}
        <IconButton
          icon={Copy}
          label={t('common:list.actions.duplicate')}
          onClick={() => onDuplicate(item)}
        />
        <IconButton
          icon={Download}
          label={t('common:list.actions.export')}
          onClick={() => onExport(item)}
        />
        <IconButton
          icon={Trash2}
          label={t('common:list.actions.delete')}
          onClick={disableDelete ? undefined : () => onDelete(item)}
          disabled={disableDelete}
          className="bg-delete text-on-delete hover:bg-delete-hover"
        />
        <div className="ml-auto flex items-center gap-1">
          <DragHandle {...dragHandleProps} label={t('common:list.actions.reorder')} />
        </div>
      </div>
    </div>
  )
}

export default ListEntryCard
