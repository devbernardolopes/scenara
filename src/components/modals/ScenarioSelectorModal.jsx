import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSwipe } from '../../hooks/useSwipe'
import { useIsMobile } from '../../hooks/useIsMobile'
import ModalShell from '../shared/ModalShell'
import { replaceVars } from '../../services/chatApi'
import { getSetting } from '../../services/settings'
import { getPersona } from '../../services/personas'
import { ChevronLeft, ChevronRight } from '../../lib/icons'

function ScenarioSelectorModal({ character, persona, scenarios, onSelect, onCancel }) {
  const { t } = useTranslation('characterCreation')
  const { closeModal } = useModal()

  const contentRef = useRef(null)
  const isMobile = useIsMobile()
  const activeIdx = scenarios.findIndex((s) => s.active)
  const [currentIndex, setCurrentIndex] = useState(activeIdx >= 0 ? activeIdx : 0)
  const [resolvedPersonaName, setResolvedPersonaName] = useState(persona?.name || '')

  useEffect(() => {
    if (persona?.name) return
    let cancelled = false
    getSetting('defaultPersonaId').then((id) => {
      if (cancelled || !id) return
      getPersona(id).then((p) => {
        if (!cancelled && p?.name) setResolvedPersonaName(p.name)
      })
    })
    return () => {
      cancelled = true
    }
  }, [persona?.name])

  function handleStartWithout() {
    onSelect(null)
    closeModal()
  }

  const scenario = scenarios[currentIndex]
  const charName = character?.name || ''

  const resolvedContent = replaceVars(scenario?.content || '', {
    charName,
    personaName: resolvedPersonaName,
    currentPersonaName: resolvedPersonaName,
  })

  const scenarioTitle = scenario?.name?.trim() || `${t('scenarioLabel')} #${currentIndex + 1}`

  function handlePrev() {
    setCurrentIndex((i) => (i - 1 + scenarios.length) % scenarios.length)
  }

  function handleNext() {
    setCurrentIndex((i) => (i + 1) % scenarios.length)
  }

  useSwipe(contentRef, {
    onSwipeLeft: handleNext,
    onSwipeRight: handlePrev,
    enabled: isMobile && scenarios.length > 1,
    threshold: 50,
  })

  function handleCancel() {
    onCancel?.()
    closeModal()
  }

  function handleSelect() {
    onSelect(scenario)
    closeModal()
  }

  return (
    <ModalShell
      title={t('scenarioSelector.title')}
      onClose={handleCancel}
      footer={
        <>
          <button
            type="button"
            onClick={handleCancel}
            className="min-h-[44px] px-4 py-2 rounded-md text-sm font-medium border border-border bg-surface text-text hover:bg-surface-hover transition-colors"
          >
            {t('scenarioSelector.cancel')}
          </button>
          <button
            type="button"
            onClick={handleStartWithout}
            className="min-h-[44px] px-4 py-2 rounded-md text-sm font-medium border border-warning text-warning hover:bg-surface-hover transition-colors"
          >
            {t('scenarioSelector.startWithNoScenario')}
          </button>
          <button
            type="button"
            onClick={handleSelect}
            className="min-h-[44px] px-4 py-2 text-sm font-medium btn-primary transition-colors"
          >
            {t('scenarioSelector.startWithScenario')}
          </button>
        </>
      }
    >
      <div className="flex-1 min-h-0 flex items-stretch gap-2">
        <button
          type="button"
          onClick={handlePrev}
          className="flex items-center justify-center w-10 shrink-0 rounded-md hover:bg-surface-hover text-tertiary hover:text-text transition-colors"
          aria-label={t('scenarioSelector.previousScenario')}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="mb-2 text-center">
            <h3 className="text-base font-semibold text-text">{scenarioTitle}</h3>
            <span className="text-xs text-tertiary">
              {currentIndex + 1} / {scenarios.length}
            </span>
          </div>

          <div
            ref={contentRef}
            style={{ willChange: isMobile && scenarios.length > 1 ? 'transform' : undefined }}
            className="flex-1 min-h-0 overflow-y-auto rounded-md border border-border bg-surface-secondary p-4"
          >
            {resolvedContent ? (
              <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">
                {resolvedContent}
              </p>
            ) : (
              <p className="text-sm text-tertiary italic">{t('scenarioSelector.noContent')}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleNext}
          className="flex items-center justify-center w-10 shrink-0 rounded-md hover:bg-surface-hover text-tertiary hover:text-text transition-colors"
          aria-label={t('scenarioSelector.nextScenario')}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </ModalShell>
  )
}

export default ScenarioSelectorModal
