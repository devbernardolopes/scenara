import { useTranslation } from 'react-i18next'
import { isViewableImage } from '../../lib/image'
import { Heart } from '../../lib/icons'
import StartChatButton from './StartChatButton'

function FavoritesShelf({
  characters,
  onSelect,
  onToggleFavorite,
  onStart,
  openPersonaFor,
  onTogglePersona,
  onClosePersona,
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
          <div key={char.id} className="shrink-0 w-36 flex flex-col items-center">
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
          </div>
        ))}
      </div>
    </div>
  )
}

export default FavoritesShelf
