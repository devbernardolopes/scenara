import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import IconButton from './IconButton'
import Avatar from './Avatar'
import { Edit3, Star, Copy, Download, Trash2, ChevronUp, ChevronDown } from '../../lib/icons'

function PersonaCard({
  persona,
  selected,
  onToggleSelect,
  onEdit,
  onSetDefault,
  onDelete,
  onDuplicate,
  onExport,
  isOnlyOne,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}) {
  const { t } = useTranslation('settings')
  const { openModal } = useModal()

  return (
    <div
      className={`border rounded-lg p-3 bg-surface transition-shadow cursor-pointer ${
        selected ? 'border-primary ring-1 ring-primary' : 'border-border'
      }`}
      onClick={() => onEdit(persona)}
    >
      <div className="flex items-start gap-3">
        <label
          className="flex items-center min-h-[44px] min-w-[44px] cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(persona.id)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
        </label>

        <Avatar
          src={persona.avatar}
          size="md"
          onClick={(e) => {
            e.stopPropagation()
            openModal('imageViewer', { src: persona.avatar, modalSize: 'fullscreen' })
          }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-text truncate">{persona.name}</span>
            {persona.color && (
              <span
                className="inline-block w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: persona.color }}
                title={t('persona.colorLabel')}
              />
            )}
            {persona.isDefault ? (
              <span className="text-xs bg-primary-subtle text-primary px-1.5 py-0.5 rounded font-medium">
                {t('persona.defaultBadge')}
              </span>
            ) : null}
          </div>
          {persona.title && (
            <p className="text-xs text-tertiary truncate mt-0.5">{persona.title}</p>
          )}
          {persona.description && (
            <p className="text-sm text-secondary line-clamp-2 mt-0.5">{persona.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 mt-1 -ml-1">
        <IconButton
          icon={Edit3}
          label={t('persona.actions.edit')}
          onClick={() => onEdit(persona)}
        />
        <IconButton
          icon={Star}
          label={t('persona.actions.setDefault')}
          onClick={() => onSetDefault(persona)}
        />
        <IconButton
          icon={Copy}
          label={t('persona.actions.duplicate')}
          onClick={() => onDuplicate(persona)}
        />
        <IconButton
          icon={Download}
          label={t('persona.actions.export')}
          onClick={() => onExport(persona)}
        />
        <IconButton
          icon={Trash2}
          label={t('persona.actions.delete')}
          onClick={isOnlyOne ? undefined : () => onDelete(persona)}
          disabled={isOnlyOne}
        />
        <div className="ml-auto flex items-center gap-1">
          <IconButton icon={ChevronUp} label="Move up" onClick={onMoveUp} disabled={isFirst} />
          <IconButton icon={ChevronDown} label="Move down" onClick={onMoveDown} disabled={isLast} />
        </div>
      </div>
    </div>
  )
}

export default PersonaCard
