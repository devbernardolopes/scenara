import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { isViewableImage } from '../../lib/image'
import { Heart, MoreHorizontal } from '../../lib/icons'
import StartChatButton from './StartChatButton'
import CharacterActionsMenu from './CharacterActionsMenu'

function ShelfItem({
  char,
  folders,
  onSelect,
  onToggleFavorite,
  onStart,
  openPersonaFor,
  onTogglePersona,
  onClosePersona,
  openMore,
  onToggleMore,
  onCloseMore,
  onFavorite,
  onMoveToFolder,
  onDuplicate,
  onExport,
  onDelete,
}) {
  const { t } = useTranslation('common')
  const anchorRef = useRef(null)

  return (
    <div className="shrink-0 w-36 flex flex-col items-center">
      <div className="relative">
        <button
          type="button"
          onClick={() => onSelect(char)}
          className="w-16 h-16 rounded-full overflow-hidden bg-surface-secondary flex items-center justify-center"
          aria-label={t('sidebar.editCharacter')}
          title={char.displayName || char.name}
        >
          {char.avatar && isViewableImage(char.avatar) ? (
            <img
              src={char.avatar}
              alt={char.displayName || char.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xl">{char.avatar || '👤'}</span>
          )}
        </button>
        <button
          ref={anchorRef}
          type="button"
          onClick={() => onToggleMore(char.id)}
          className="absolute -top-1 -left-1 size-8 flex items-center justify-center rounded-full bg-glass border-glass text-secondary hover:text-text shadow-surface-sm"
          aria-label={t('discovery.actions.moreOptions')}
          title={t('discovery.actions.moreOptions')}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onToggleFavorite(char)}
          className="absolute -top-1 -right-1 size-8 flex items-center justify-center rounded-full bg-glass border-glass text-favorite hover:text-delete shadow-surface-sm"
          aria-label={t('discovery.actions.unfavorite')}
          title={t('discovery.actions.unfavorite')}
        >
          <Heart className="w-4 h-4 fill-current" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => onSelect(char)}
        className="text-xs text-text truncate w-full mt-1 text-center"
      >
        {char.displayName || char.name}
      </button>
      <div className="mt-1.5 w-full">
        <StartChatButton
          character={char}
          onStart={onStart}
          open={openPersonaFor === char.id}
          onToggle={() => onTogglePersona(char.id)}
          onClose={onClosePersona}
        />
      </div>
      <CharacterActionsMenu
        open={openMore === char.id}
        onClose={onCloseMore}
        anchorRef={anchorRef}
        character={char}
        folders={folders}
        onFavorite={onFavorite}
        onMoveToFolder={(folderId) => onMoveToFolder(char, folderId)}
        onDuplicate={onDuplicate}
        onExport={onExport}
        onDelete={onDelete}
      />
    </div>
  )
}

function FavoritesShelf({
  characters,
  onSelect,
  onToggleFavorite,
  onStart,
  openPersonaFor,
  onTogglePersona,
  onClosePersona,
  openMore,
  onToggleMore,
  onCloseMore,
  folders,
  onFavorite,
  onMoveToFolder,
  onDuplicate,
  onExport,
  onDelete,
}) {
  const { t } = useTranslation('common')
  if (characters.length === 0) return null
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 px-1 pb-2 text-secondary">
        <Heart className="w-3.5 h-3.5 fill-current text-favorite" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {t('discovery.favorites.title')}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {characters.map((char) => (
          <ShelfItem
            key={char.id}
            char={char}
            folders={folders}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
            onStart={onStart}
            openPersonaFor={openPersonaFor}
            onTogglePersona={onTogglePersona}
            onClosePersona={onClosePersona}
            openMore={openMore}
            onToggleMore={onToggleMore}
            onCloseMore={onCloseMore}
            onFavorite={onFavorite}
            onMoveToFolder={onMoveToFolder}
            onDuplicate={onDuplicate}
            onExport={onExport}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}

export default FavoritesShelf
