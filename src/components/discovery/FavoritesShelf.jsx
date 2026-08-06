import { useTranslation } from 'react-i18next'
import { isViewableImage } from '../../lib/image'
import { Heart } from '../../lib/icons'

function FavoritesShelf({ characters, onSelect }) {
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
          <button
            key={char.id}
            type="button"
            onClick={() => onSelect(char)}
            className="shrink-0 w-20 flex flex-col items-center gap-1 text-center"
          >
            <div className="relative w-16 h-16 rounded-full overflow-hidden bg-surface-secondary flex items-center justify-center">
              {char.avatar && isViewableImage(char.avatar) ? (
                <img
                  src={char.avatar}
                  alt={char.displayName || char.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl">{char.avatar || '👤'}</span>
              )}
            </div>
            <span className="text-xs text-text truncate w-full">
              {char.displayName || char.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default FavoritesShelf
