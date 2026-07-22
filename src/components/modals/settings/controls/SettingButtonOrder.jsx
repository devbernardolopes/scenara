import { useTranslation } from 'react-i18next'
import { GripVertical } from '../../../../lib/icons'
import { SortableList, SortableItem } from '../../../shared/SortableList'

function SettingButtonOrder({ value = [], onChange, disabled, buttons = [] }) {
  const { t } = useTranslation('settings')

  if (buttons.length === 0) return null

  const ordered = buttons.slice().sort((a, b) => {
    const ia = value.indexOf(a.key)
    const ib = value.indexOf(b.key)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })

  return (
    <div className="space-y-1">
      <SortableList items={ordered} getId={(btn) => btn.key} onReorder={(ids) => onChange(ids)}>
        {(btn) => (
          <SortableItem id={btn.key} key={btn.key}>
            {(sortable) => (
              <div
                ref={sortable.setNodeRef}
                style={sortable.style}
                className="flex items-center gap-1 min-h-[44px] px-2 rounded-md bg-surface-secondary shadow-surface-sm"
              >
                {disabled ? (
                  <span className="min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary opacity-30 shrink-0">
                    <GripVertical className="w-4 h-4" />
                  </span>
                ) : (
                  <button
                    type="button"
                    {...sortable.dragHandleProps.attributes}
                    {...sortable.dragHandleProps.listeners}
                    onClick={(e) => e.stopPropagation()}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text cursor-grab active:cursor-grabbing touch-none shrink-0"
                    aria-label={t('common:list.actions.reorder')}
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>
                )}
                <span className="flex-1 text-sm text-text min-w-0 truncate">
                  {t(btn.labelKey.replace('settings:', ''))}
                </span>
              </div>
            )}
          </SortableItem>
        )}
      </SortableList>
    </div>
  )
}

export default SettingButtonOrder
