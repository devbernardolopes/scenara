import { useTranslation } from 'react-i18next'

const SECTIONS = [
  { id: 'character', labelKey: 'sectionCharacter' },
  { id: 'overrides', labelKey: 'sectionOverrides' },
  { id: 'postProcessing', labelKey: 'sectionPostProcessing' },
  { id: 'initialMessages', labelKey: 'sectionInitialMessages' },
  { id: 'exampleMessages', labelKey: 'sectionExampleMessages' },
  { id: 'scenarios', labelKey: 'sectionScenarios' },
  { id: 'director', labelKey: 'sectionDirector' },
  { id: 'lorebooks', labelKey: 'sectionLorebooks' },
  { id: 'tags', labelKey: 'sectionTags' },
  { id: '3d', labelKey: 'section3d' },
  { id: 'sfx', labelKey: 'sectionSfx' },
  { id: 'fullData', labelKey: 'sectionFullData' },
]

function CharacterSidebar({ active, onSelect, highlights }) {
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
                  : highlights?.[sec.id]
                    ? 'text-highlight hover:bg-surface-hover'
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
