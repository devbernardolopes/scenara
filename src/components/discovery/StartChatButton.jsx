import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from '../../lib/icons'
import PersonaPicker from '../shared/PersonaPicker'

function StartChatButton({ character, onStart, open, onToggle, onClose }) {
  const { t } = useTranslation('common')
  const anchorRef = useRef(null)

  return (
    <div className="relative" ref={anchorRef}>
      <div className="character-card__start-btn flex bg-surface-secondary rounded-md overflow-hidden">
        <button
          type="button"
          onClick={() => onStart(character, null)}
          className="flex-1 min-h-[44px] px-3 text-sm font-medium text-primary hover:bg-surface-hover"
        >
          {t('discovery.startChat')}
        </button>
        <div className="w-px bg-border-light self-stretch" />
        <button
          type="button"
          onClick={onToggle}
          onMouseDown={(e) => e.stopPropagation()}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-secondary hover:text-text hover:bg-surface-hover"
          aria-label={t('discovery.actions.selectPersona')}
          title={t('discovery.actions.selectPersona')}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
      <PersonaPicker
        open={open}
        anchorRef={anchorRef}
        onClose={onClose}
        onSelect={(persona) => {
          onClose()
          onStart(character, persona)
        }}
      />
    </div>
  )
}

export default StartChatButton
