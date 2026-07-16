import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Edit3,
  Trash2,
  Copy,
  Pin,
  PinOff,
  Lock,
  Unlock,
  Palette,
  CheckSquare,
  Square,
  RefreshCw,
} from '../../lib/icons'
import ThreadCardTitle from './ThreadCardTitle'
import { getColorHex } from '../../config/colorPalettes'

const ThreadCard = forwardRef(function ThreadCard(
  {
    thread,
    character,
    theme,
    messageCount,
    isActive,
    unreadBadges,
    generating,
    queueCount,
    threadCardMarquee,
    onClose,
    onEditTitle,
    onEditCharacter,
    onDuplicate,
    onTogglePin,
    onToggleLock,
    onToggleSelect,
    onToggleColorPicker,
    onDelete,
    selected,
  },
  ref,
) {
  const { t } = useTranslation('common')
  const threadColor = thread.colorSlot >= 0 ? getColorHex(theme, thread.colorSlot) : thread.color

  return (
    <div
      ref={ref}
      className={`rounded-lg border ${isActive ? 'border-primary' : 'border-border'} overflow-hidden border-l-[3px] p-2 flex flex-col w-full min-h-[92px]`}
      style={{
        borderLeftColor: threadColor || undefined,
        backgroundColor: threadColor
          ? `color-mix(in srgb, ${threadColor} 12%, var(--color-surface))`
          : undefined,
      }}
    >
      <Link
        to={`/chat/${thread.id}`}
        onClick={onClose}
        className="flex items-stretch gap-0 min-w-0 flex-1 min-h-0"
      >
        <div className="w-22 flex-shrink-0 self-stretch rounded-l-lg overflow-hidden relative bg-surface-hover">
          {character?.avatar &&
          (/^https?:\/\//.test(character.avatar) || character.avatar.startsWith('data:image/')) ? (
            <img
              src={character.avatar}
              alt={character?.name || ''}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex items-center justify-center h-full w-full text-3xl">
              {character?.avatar || '👤'}
            </span>
          )}
          <div className="absolute bottom-0 inset-x-0 bg-image-scrim px-1 py-0.5">
            <p className="text-center text-[11px] text-on-image leading-none truncate">
              #{thread.threadNumber} · {messageCount}
            </p>
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1 pl-2">
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <ThreadCardTitle
                title={thread.title}
                isActive={isActive}
                threadCardMarquee={threadCardMarquee}
              />
              <div className="flex items-center gap-1.5 shrink-0">
                {unreadBadges && (thread.unreadCount || 0) > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-badge-unread-text bg-badge-unread rounded-full">
                    {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                  </span>
                )}
                {generating && <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />}
                {queueCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-badge-queue-text bg-badge-queue rounded-full">
                    {queueCount}
                  </span>
                )}
              </div>
            </div>
            <div className="w-[26px] shrink-0 flex justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onEditTitle(thread)
                }}
                className="w-[26px] h-[26px] flex items-center justify-center rounded text-tertiary hover:text-text hover:bg-surface-hover"
                aria-label={t('sidebar.editThreadTitle')}
                title={t('sidebar.editThreadTitle')}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <p className="text-xs text-secondary truncate flex-1 min-w-0">
              {t('sidebar.characterNameWithId', {
                name: character?.name || t('sidebar.unknownCharacter'),
              })}
            </p>
            <div className="w-[26px] shrink-0 flex justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onEditCharacter(thread)
                }}
                className="w-[26px] h-[26px] flex items-center justify-center rounded text-tertiary hover:text-text hover:bg-surface-hover"
                aria-label={t('sidebar.editCharacter')}
                title={t('sidebar.editCharacter')}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="w-[26px] shrink-0 flex justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onToggleLock(thread)
                }}
                className={`w-[26px] h-[26px] flex items-center justify-center rounded hover:bg-surface-hover ${thread.isLocked ? 'text-primary' : 'text-tertiary hover:text-text'}`}
                aria-label={thread.isLocked ? t('sidebar.unlock') : t('sidebar.lock')}
                title={thread.isLocked ? t('sidebar.unlock') : t('sidebar.lock')}
              >
                {thread.isLocked ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <div className="w-[26px] shrink-0 flex justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onToggleColorPicker(e, thread)
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                }}
                className={`w-[26px] h-[26px] flex items-center justify-center rounded hover:bg-surface-hover ${threadColor ? 'text-primary' : 'text-tertiary hover:text-text'}`}
                style={threadColor ? { color: threadColor } : undefined}
                aria-label={t('sidebar.color')}
                title={t('sidebar.color')}
              >
                <Palette
                  className="w-3.5 h-3.5"
                  style={threadColor ? { fill: threadColor } : undefined}
                />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-auto justify-end">
            {!thread.isLocked && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onToggleSelect(thread.id)
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-tertiary hover:text-text hover:bg-surface-hover flex-shrink-0"
                aria-label={t('sidebar.selectThreads')}
              >
                {selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onDuplicate(thread)
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-tertiary hover:text-text hover:bg-surface-hover"
              aria-label={t('sidebar.duplicateThread')}
              title={t('sidebar.duplicateThread')}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onTogglePin(thread)
              }}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:bg-surface-hover ${thread.isFavorite ? 'text-primary' : 'text-tertiary hover:text-text'}`}
              aria-label={thread.isFavorite ? t('sidebar.unpin') : t('sidebar.pin')}
              title={thread.isFavorite ? t('sidebar.unpin') : t('sidebar.pin')}
            >
              {thread.isFavorite ? (
                <Pin className="w-3.5 h-3.5 fill-current" />
              ) : (
                <PinOff className="w-3.5 h-3.5" />
              )}
            </button>
            {!thread.isLocked && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete(thread)
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded bg-delete text-on-delete hover:bg-delete-hover"
                aria-label={t('sidebar.deleteThread')}
                title={t('sidebar.deleteThread')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </Link>
    </div>
  )
})

export default ThreadCard
