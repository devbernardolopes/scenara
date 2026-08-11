import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isViewableImage } from '../../lib/image'
import { ChevronLeft, ChevronRight, Heart, MoreHorizontal } from '../../lib/icons'
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
  const scrollRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 0)
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [characters.length])

  const scrollByPage = (dir) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  if (characters.length === 0) return null
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 px-1 pb-2 text-secondary">
        <Heart className="w-3.5 h-3.5 fill-current text-favorite" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {t('discovery.favorites.title')}
        </span>
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-1">
          <button
            type="button"
            onClick={() => scrollByPage(-1)}
            disabled={!canScrollLeft}
            aria-label={t('discovery.favorites.scrollLeft')}
            title={t('discovery.favorites.scrollLeft')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-tertiary hover:text-text hover:bg-surface-hover disabled:opacity-40 disabled:hover:text-tertiary disabled:hover:bg-transparent disabled:cursor-default"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByPage(1)}
            disabled={!canScrollRight}
            aria-label={t('discovery.favorites.scrollRight')}
            title={t('discovery.favorites.scrollRight')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-tertiary hover:text-text hover:bg-surface-hover disabled:opacity-40 disabled:hover:text-tertiary disabled:hover:bg-transparent disabled:cursor-default"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-1">
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
