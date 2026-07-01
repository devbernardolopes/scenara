import { useTranslation } from 'react-i18next'

const SECTIONS = [
  { id: 'character', labelKey: 'sectionCharacter' },
  { id: 'overrides', labelKey: 'sectionOverrides' },
  { id: '3d', labelKey: 'section3d' },
  { id: 'sfx', labelKey: 'sectionSfx' },
  { id: 'tags', labelKey: 'sectionTags' },
  { id: 'lorebooks', labelKey: 'sectionLorebooks' },
]

function CharacterSidebar({ active, onSelect }) {
  const { t } = useTranslation('characterCreation')

  return (
    <nav className="w-44 shrink-0 border-r border-border overflow-y-auto px-4 py-4 hidden md:block">
      <ul className="space-y-1">
        {SECTIONS.map((sec) => (
          <li key={sec.id}>
            <button
              onClick={() => onSelect(sec.id)}
              className={`w-full text-left px-3 min-h-[44px] rounded-md text-sm ${
                active === sec.id
                  ? 'bg-primary-subtle text-primary font-medium'
                  : 'text-secondary hover:bg-surface-hover'
              }`}
            >
              {t(sec.labelKey)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default CharacterSidebar
