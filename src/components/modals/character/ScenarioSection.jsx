import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../../lib/confirm'
import CollapsibleSection from '../../shared/CollapsibleSection'
import AutoResizeTextarea from '../../shared/AutoResizeTextarea'
import { estimateTokens } from '../../../services/tokenEstimator'
import { Plus, Trash2, BrainCog, Zap, Square, Copy, X } from '../../../lib/icons'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm'

export const LIFETIME_OPTIONS = [
  { value: 'oneTime', labelKey: 'scenarioLifetimeOptions.oneTime' },
  { value: 'firstSummary', labelKey: 'scenarioLifetimeOptions.firstSummary' },
  { value: 'always', labelKey: 'scenarioLifetimeOptions.always' },
]

export function LifetimeButtonGroup({ options, value, onChange, disabled }) {
  const { t } = useTranslation('characterCreation')
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const val = opt.value
        const label = t(opt.labelKey)
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            disabled={disabled}
            className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              value === val
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface text-secondary border-border hover:bg-surface-hover'
            }${disabled ? ' opacity-40 cursor-not-allowed' : ''}`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function countWords(text) {
  const trimmed = (text || '').trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function AddButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full sticky top-0 z-10 min-h-[44px] flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-md bg-surface text-secondary hover:text-text hover:border-border-light transition-colors"
    >
      <Plus className="w-4 h-4" />
      <span className="text-sm">{label}</span>
    </button>
  )
}

function ScenarioSection({ form, onChange, characterId }) {
  const { t } = useTranslation('characterCreation')
  const { confirm } = useConfirm()
  const scenarios = form.scenarios || []
  const [globalLifetime, setGlobalLifetime] = useState(() => {
    return scenarios[0]?.lifetime || 'firstSummary'
  })

  function handleAdd() {
    const next = {
      id: crypto.randomUUID(),
      content: '',
      statusBlock: '',
      lifetime: 'firstSummary',
      active: scenarios.length === 0,
    }
    onChange('scenarios', [...scenarios, next])
  }

  function handleContentChange(id, content) {
    onChange(
      'scenarios',
      scenarios.map((s) =>
        s.id === id ? { ...s, content, active: content.trim() ? s.active : false } : s,
      ),
    )
  }

  function handleStatusBlockChange(id, statusBlock) {
    onChange(
      'scenarios',
      scenarios.map((s) => (s.id === id ? { ...s, statusBlock } : s)),
    )
  }

  function handleNameChange(id, name) {
    onChange(
      'scenarios',
      scenarios.map((s) => (s.id === id ? { ...s, name } : s)),
    )
  }

  function handleLifetimeChange(id, lifetime) {
    onChange(
      'scenarios',
      scenarios.map((s) => (s.id === id ? { ...s, lifetime } : s)),
    )
  }

  function handleActiveChange(id, active) {
    if (active) {
      // Only one scenario can be active at a time.
      onChange(
        'scenarios',
        scenarios.map((s) => ({ ...s, active: s.id === id })),
      )
    } else {
      onChange(
        'scenarios',
        scenarios.map((s) => (s.id === id ? { ...s, active: false } : s)),
      )
    }
  }

  async function handleDelete(scenario, e) {
    e.stopPropagation()
    const ok = await confirm({
      title: t('confirmDeleteScenarioTitle'),
      message: t('confirmDeleteScenario'),
      confirmLabel: t('deleteScenario'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    })
    if (!ok) return
    onChange(
      'scenarios',
      scenarios.filter((s) => s.id !== scenario.id),
    )
  }

  function handleDuplicate(scenario) {
    const hasActive = scenarios.some((s) => s.active)
    const clone = {
      ...scenario,
      id: crypto.randomUUID(),
      name: scenario.name ? `${scenario.name} (Copy)` : '',
      active: !hasActive ? true : false,
    }
    onChange('scenarios', [...scenarios, clone])
  }

  function handleClear(scenario, e) {
    e.stopPropagation()
    handleContentChange(scenario.id, '')
  }

  function handleClearStatusBlock(scenario, e) {
    e.stopPropagation()
    handleStatusBlockChange(scenario.id, '')
  }

  const hasAnyContent = scenarios.some((s) => s.content?.trim())

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm text-text shrink-0">{t('promptUser')}</label>
        <button
          type="button"
          role="switch"
          aria-checked={form.promptUser !== false}
          aria-label={t('promptUser')}
          disabled={!hasAnyContent}
          onClick={() => onChange('promptUser', form.promptUser === false)}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
            form.promptUser !== false ? 'toggle-track-on' : 'toggle-track-off'
          }${!hasAnyContent ? ' opacity-40 cursor-not-allowed' : ''}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full toggle-knob transform transition-transform duration-200 ${
              form.promptUser !== false ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
        <span className="text-xs text-tertiary">{t('promptUserDesc')}</span>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-text shrink-0">{t('scenarioLifetime')}</label>
        <LifetimeButtonGroup
          options={LIFETIME_OPTIONS}
          value={globalLifetime}
          disabled={!hasAnyContent}
          onChange={async (value) => {
            // Section-level default: applies to every existing scenario and is
            // inherited by newly added ones (see handleAdd).
            const ok = await confirm({
              title: t('confirmLifetimeTitle'),
              message: t('confirmLifetime'),
              confirmLabel: t('confirmLifetimeConfirm'),
              cancelLabel: t('cancel'),
              variant: 'warning',
            })
            if (!ok) return
            setGlobalLifetime(value)
            onChange(
              'scenarios',
              scenarios.map((s) => ({ ...s, lifetime: value })),
            )
          }}
        />
      </div>

      <AddButton onClick={handleAdd} label={t('addScenario')} />

      {scenarios.length === 0 ? (
        <p className="text-sm text-tertiary text-center py-8">{t('noScenarios')}</p>
      ) : (
        scenarios.map((scenario, idx) => (
          <div key={scenario.id} className="rounded-md shadow-surface-sm">
            <CollapsibleSection
              label={scenario.name?.trim() || `${t('scenarioLabel')} #${idx + 1}`}
              storageKey={
                characterId ? `charSection.scenario.${characterId}.${scenario.id}` : undefined
              }
              defaultExpanded={!scenario.content}
              headerExtra={
                <>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(scenario, e)}
                    className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded-md bg-delete text-on-delete hover:bg-delete-hover transition-colors"
                    aria-label={t('deleteScenario')}
                    title={t('deleteScenario')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!scenario.active}
                    aria-label={t('scenarioActive')}
                    title={t('scenarioActive')}
                    disabled={!scenario.content?.trim()}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleActiveChange(scenario.id, !scenario.active)
                    }}
                    className={`min-h-[28px] min-w-[28px] flex items-center justify-center rounded-md border transition-colors ${
                      scenario.active
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface text-tertiary border-border hover:bg-surface-hover'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {scenario.active ? <Zap className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                </>
              }
              summary={
                scenario.content ? (
                  <>
                    {t('common:tokenCount', { count: estimateTokens(scenario.content) })}
                    <span className="ml-2">
                      {t('chat:words', { count: countWords(scenario.content) })}
                    </span>
                  </>
                ) : null
              }
              hasContent={!!scenario.content}
            >
              <input
                type="text"
                className={`${inputClass} mb-2`}
                value={scenario.name || ''}
                onChange={(e) => handleNameChange(scenario.id, e.target.value)}
                placeholder={t('scenarioNamePlaceholder')}
              />

              <div className="relative mt-2">
                <AutoResizeTextarea
                  className={`${inputClass} resize-none pr-12 min-h-[128px]`}
                  value={scenario.content}
                  onChange={(e) => handleContentChange(scenario.id, e.target.value)}
                  placeholder={t('scenarioPlaceholder')}
                  extraHeight={8}
                />
                <div className="absolute top-2 right-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleClear(scenario, e)}
                    disabled={!scenario.content?.trim()}
                    className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md bg-surface text-secondary hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={t('clearScenario')}
                    title={t('clearScenario')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {}}
                    className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md bg-surface text-secondary hover:bg-surface-hover transition-colors"
                    aria-label={t('generateScenario')}
                    title={t('generateScenario')}
                  >
                    <BrainCog className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(scenario)}
                    disabled={!scenario.content?.trim()}
                    className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md bg-surface text-secondary hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={t('duplicateScenario')}
                    title={t('duplicateScenario')}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <CollapsibleSection
                  label={t('scenarioStatusBlockLabel')}
                  summary={
                    scenario.statusBlock
                      ? t('common:tokenCount', { count: estimateTokens(scenario.statusBlock) })
                      : null
                  }
                  storageKey={
                    characterId
                      ? `charSection.scenarioStatusBlock.${characterId}.${scenario.id}`
                      : undefined
                  }
                  defaultExpanded={false}
                  hasContent={!!scenario.statusBlock}
                >
                  <div className="relative mt-2">
                    <AutoResizeTextarea
                      className={`${inputClass} resize-none pr-12 min-h-[128px]`}
                      value={scenario.statusBlock || ''}
                      onChange={(e) => handleStatusBlockChange(scenario.id, e.target.value)}
                      placeholder={t('scenarioStatusBlockPlaceholder')}
                      extraHeight={8}
                    />
                    <div className="absolute top-2 right-2">
                      <button
                        type="button"
                        onClick={(e) => handleClearStatusBlock(scenario, e)}
                        disabled={!scenario.statusBlock?.trim()}
                        className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md bg-surface text-secondary hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={t('clearScenarioStatusBlock')}
                        title={t('clearScenarioStatusBlock')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CollapsibleSection>
              </div>

              <div className="mt-3">
                <LifetimeButtonGroup
                  options={LIFETIME_OPTIONS}
                  value={scenario.lifetime || 'firstSummary'}
                  onChange={(value) => handleLifetimeChange(scenario.id, value)}
                />
              </div>
            </CollapsibleSection>
          </div>
        ))
      )}
    </div>
  )
}

export default ScenarioSection
