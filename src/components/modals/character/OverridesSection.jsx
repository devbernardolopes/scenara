import { useTranslation } from 'react-i18next'
import CollapsibleSection from '../../shared/CollapsibleSection'
import AutoResizeTextarea from '../../shared/AutoResizeTextarea'
import { estimateTokens } from '../../../services/tokenEstimator'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'
const numberClass =
  'w-24 px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

const AVATAR_SCALE_OPTIONS = ['1x', '2x', '3x', '4x']

const MEMORY_OPTIONS = [
  { value: 'never', labelKey: 'memoryOptions.never' },
  { value: 'messages', labelKey: 'memoryOptions.messages' },
  { value: 'contextWindow', labelKey: 'memoryOptions.contextWindow' },
]

const PERSONA_INJECTION_TIMING_OPTIONS = [
  { value: 'always', labelKey: 'personaInjectionTimingOptions.always' },
  { value: 'never', labelKey: 'personaInjectionTimingOptions.never' },
]

const WRITING_INJECTION_TIMING_OPTIONS = [
  { value: 'always', labelKey: 'writingInjectionTimingOptions.always' },
  { value: 'never', labelKey: 'writingInjectionTimingOptions.never' },
]

const WRITING_PLACEMENT_OPTIONS = [
  { value: 'endOfSystemPrompt', labelKey: 'writingPlacementOptions.endOfSystemPrompt' },
  { value: 'endOfMessages', labelKey: 'writingPlacementOptions.endOfMessages' },
]

const WRITING_MESSAGE_ROLE_OPTIONS = [
  { value: 'system', labelKey: 'writingMessageRoleOptions.system' },
  { value: 'assistant', labelKey: 'writingMessageRoleOptions.assistant' },
]

const PERSONA_PLACEMENT_OPTIONS = [
  { value: 'endOfSystemPrompt', labelKey: 'personaInjectionPlacementOptions.endOfSystemPrompt' },
  { value: 'endOfMessages', labelKey: 'personaInjectionPlacementOptions.endOfMessages' },
]

const PERSONA_MESSAGE_ROLE_OPTIONS = [
  { value: 'system', labelKey: 'personaInjectionMessageRoleOptions.system' },
  { value: 'assistant', labelKey: 'personaInjectionMessageRoleOptions.assistant' },
]

function ButtonGroup({ options, value, onChange, disabled }) {
  const { t } = useTranslation('characterCreation')
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value
        const label = typeof opt === 'string' ? opt : t(opt.labelKey)
        return (
          <button
            key={val}
            type="button"
            onClick={() => !disabled && onChange(val)}
            disabled={disabled}
            className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
              disabled
                ? 'bg-surface text-tertiary border-border cursor-not-allowed'
                : value === val
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface text-secondary border-border hover:bg-surface-hover'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function OverridesSection({ form, onChange, characterId }) {
  const { t } = useTranslation('characterCreation')

  const disabledCls = (disabled) => (disabled ? 'opacity-40 pointer-events-none' : '')

  return (
    <div className="space-y-5">
      <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
        <input
          type="checkbox"
          checked={form.autoTitle}
          onChange={(e) => onChange('autoTitle', e.target.checked)}
          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
        />
        <span className="text-sm text-text">{t('autoTitle')}</span>
      </label>

      <div className={`ml-7 space-y-4 ${disabledCls(!form.autoTitle)}`}>
        <div className="flex items-center gap-3">
          <label className="text-sm text-secondary shrink-0">{t('autoTitleThreshold')}</label>
          <input
            type="number"
            className={numberClass}
            value={form.autoTitleThreshold}
            onChange={(e) => onChange('autoTitleThreshold', Number(e.target.value))}
            disabled={!form.autoTitle}
            min={3}
            max={10}
            step={1}
          />
        </div>

        <CollapsibleSection
          label={t('autoTitleSystemInstructions')}
          summary={
            form.autoTitleSystemInstructions
              ? t('common:tokenCount', { count: estimateTokens(form.autoTitleSystemInstructions) })
              : null
          }
          storageKey={characterId ? `charSection.autoTitleSystem.${characterId}` : undefined}
          defaultExpanded={false}
        >
          <AutoResizeTextarea
            className={`${inputClass} resize-none mt-2`}
            value={form.autoTitleSystemInstructions}
            onChange={(e) => onChange('autoTitleSystemInstructions', e.target.value)}
            placeholder={t('autoTitleSystemInstructionsPlaceholder')}
            disabled={!form.autoTitle}
          />
        </CollapsibleSection>

        <CollapsibleSection
          label={t('autoTitleUserInstructions')}
          summary={
            form.autoTitleUserInstructions
              ? t('common:tokenCount', { count: estimateTokens(form.autoTitleUserInstructions) })
              : null
          }
          storageKey={characterId ? `charSection.autoTitleUser.${characterId}` : undefined}
          defaultExpanded={false}
        >
          <AutoResizeTextarea
            className={`${inputClass} resize-none mt-2`}
            value={form.autoTitleUserInstructions}
            onChange={(e) => onChange('autoTitleUserInstructions', e.target.value)}
            placeholder={t('autoTitleUserInstructionsPlaceholder')}
            disabled={!form.autoTitle}
          />
        </CollapsibleSection>
      </div>

      <hr className="border-border" />

      <div className="flex items-center gap-3">
        <label className="text-sm text-text shrink-0">{t('memory')}</label>
        <ButtonGroup
          options={MEMORY_OPTIONS}
          value={form.memory}
          onChange={(v) => onChange('memory', v)}
        />
      </div>

      <div className={`ml-7 space-y-4 ${disabledCls(form.memory !== 'messages')}`}>
        <div className="flex items-center gap-3">
          <label className="text-sm text-secondary shrink-0">{t('messagesThreshold')}</label>
          <input
            type="number"
            className={numberClass}
            value={form.messagesThreshold}
            onChange={(e) => onChange('messagesThreshold', Number(e.target.value))}
            disabled={form.memory !== 'messages'}
            min={3}
            max={50}
            step={1}
          />
        </div>
      </div>

      <div className={`ml-7 space-y-4 ${disabledCls(form.memory !== 'contextWindow')}`}>
        <div className="flex items-center gap-3">
          <label className="text-sm text-secondary shrink-0">{t('contextWindowThreshold')}</label>
          <input
            type="range"
            min={256}
            max={8192}
            step={256}
            value={form.contextWindowThreshold}
            onChange={(e) => onChange('contextWindowThreshold', Number(e.target.value))}
            className="w-48 accent-primary"
          />
          <span className="text-sm text-text font-medium w-14 text-right">
            {form.contextWindowThreshold}
          </span>
        </div>
      </div>

      <div className={`ml-7 space-y-4 ${disabledCls(form.memory === 'never')}`}>
        <div className="flex items-center gap-3">
          <label className="text-sm text-secondary shrink-0">{t('messagesToKeep')}</label>
          <input
            type="number"
            className={numberClass}
            value={form.messagesToKeep}
            onChange={(e) => onChange('messagesToKeep', Number(e.target.value))}
            disabled={form.memory === 'never'}
            min={0}
            max={25}
            step={1}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-secondary shrink-0">{t('memorySlots')}</label>
          <input
            type="number"
            className={numberClass}
            value={form.memorySlots}
            onChange={(e) => onChange('memorySlots', Number(e.target.value))}
            disabled={form.memory === 'never'}
            min={1}
            max={5}
            step={1}
          />
        </div>
      </div>

      <div className={`ml-7 space-y-4 ${disabledCls(form.memory === 'never')}`}>
        <CollapsibleSection
          label={t('summarizationSystemInstructions')}
          summary={
            form.summarizationSystemInstructions
              ? t('common:tokenCount', {
                  count: estimateTokens(form.summarizationSystemInstructions),
                })
              : null
          }
          storageKey={characterId ? `charSection.summarizationSystem.${characterId}` : undefined}
          defaultExpanded={false}
        >
          <AutoResizeTextarea
            className={`${inputClass} resize-none mt-2`}
            value={form.summarizationSystemInstructions}
            onChange={(e) => onChange('summarizationSystemInstructions', e.target.value)}
            placeholder={t('summarizationSystemInstructionsPlaceholder')}
            disabled={form.memory === 'never'}
          />
        </CollapsibleSection>

        <CollapsibleSection
          label={t('summarizationUserInstructions')}
          summary={
            form.summarizationUserInstructions
              ? t('common:tokenCount', {
                  count: estimateTokens(form.summarizationUserInstructions),
                })
              : null
          }
          storageKey={characterId ? `charSection.summarizationUser.${characterId}` : undefined}
          defaultExpanded={false}
        >
          <AutoResizeTextarea
            className={`${inputClass} resize-none mt-2`}
            value={form.summarizationUserInstructions}
            onChange={(e) => onChange('summarizationUserInstructions', e.target.value)}
            placeholder={t('summarizationUserInstructionsPlaceholder')}
            disabled={form.memory === 'never'}
          />
        </CollapsibleSection>
      </div>

      <hr className="border-border" />

      <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
        <input
          type="checkbox"
          checked={form.firstMessage}
          onChange={(e) => onChange('firstMessage', e.target.checked)}
          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
        />
        <span className="text-sm text-text">{t('firstMessage')}</span>
      </label>

      <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
        <input
          type="checkbox"
          checked={form.userPersonaPrefix}
          onChange={(e) => onChange('userPersonaPrefix', e.target.checked)}
          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
        />
        <span className="text-sm text-text">{t('userPersonaPrefix')}</span>
      </label>

      <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
        <input
          type="checkbox"
          checked={form.includeOOC}
          onChange={(e) => onChange('includeOOC', e.target.checked)}
          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
        />
        <span className="text-sm text-text">{t('includeOOC')}</span>
      </label>

      <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
        <input
          type="checkbox"
          checked={form.postProcessing}
          onChange={(e) => onChange('postProcessing', e.target.checked)}
          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
        />
        <span className="text-sm text-text">{t('postProcessing')}</span>
      </label>

      <hr className="border-border" />

      <div className="flex items-center gap-3">
        <label className="text-sm text-text shrink-0">{t('systemAvatarScale')}</label>
        <ButtonGroup
          options={AVATAR_SCALE_OPTIONS}
          value={form.systemAvatarScale}
          onChange={(v) => onChange('systemAvatarScale', v)}
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-text shrink-0">{t('characterAvatarScale')}</label>
        <ButtonGroup
          options={AVATAR_SCALE_OPTIONS}
          value={form.characterAvatarScale}
          onChange={(v) => onChange('characterAvatarScale', v)}
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-text shrink-0">{t('userPersonaAvatarScale')}</label>
        <ButtonGroup
          options={AVATAR_SCALE_OPTIONS}
          value={form.userPersonaAvatarScale}
          onChange={(v) => onChange('userPersonaAvatarScale', v)}
        />
      </div>

      <hr className="border-border" />

      <div className="space-y-4">
        <p className="text-xs text-tertiary uppercase tracking-wider font-medium">
          {t('writingInjectionTiming')}
        </p>

        <div className="flex items-center gap-3">
          <label className="text-sm text-text shrink-0">{t('writingInjectionTiming')}</label>
          <ButtonGroup
            options={WRITING_INJECTION_TIMING_OPTIONS}
            value={form.writingInjectionTiming}
            onChange={(v) => onChange('writingInjectionTiming', v)}
          />
        </div>

        <div
          className={`flex items-center gap-3 ${disabledCls(form.writingInjectionTiming === 'never')}`}
        >
          <label className="text-sm text-text shrink-0">{t('writingPlacement')}</label>
          <ButtonGroup
            options={WRITING_PLACEMENT_OPTIONS}
            value={form.writingPlacement}
            onChange={(v) => onChange('writingPlacement', v)}
            disabled={form.writingInjectionTiming === 'never'}
          />
        </div>

        <div
          className={`flex items-center gap-3 ${disabledCls(form.writingPlacement !== 'endOfMessages' || form.writingInjectionTiming === 'never')}`}
        >
          <label className="text-sm text-text shrink-0">{t('writingMessageRole')}</label>
          <ButtonGroup
            options={WRITING_MESSAGE_ROLE_OPTIONS}
            value={form.writingMessageRole}
            onChange={(v) => onChange('writingMessageRole', v)}
            disabled={
              form.writingPlacement !== 'endOfMessages' || form.writingInjectionTiming === 'never'
            }
          />
        </div>
      </div>

      <hr className="border-border" />

      <div className="space-y-4">
        <p className="text-xs text-tertiary uppercase tracking-wider font-medium">
          {t('personaInjectionTiming')}
        </p>

        <div className="flex items-center gap-3">
          <label className="text-sm text-text shrink-0">{t('personaInjectionTiming')}</label>
          <ButtonGroup
            options={PERSONA_INJECTION_TIMING_OPTIONS}
            value={form.personaInjectionTiming}
            onChange={(v) => onChange('personaInjectionTiming', v)}
          />
        </div>

        <div
          className={`flex items-center gap-3 ${disabledCls(form.personaInjectionTiming === 'never')}`}
        >
          <label className="text-sm text-text shrink-0">{t('personaInjectionPlacement')}</label>
          <ButtonGroup
            options={PERSONA_PLACEMENT_OPTIONS}
            value={form.personaInjectionPlacement}
            onChange={(v) => onChange('personaInjectionPlacement', v)}
            disabled={form.personaInjectionTiming === 'never'}
          />
        </div>

        <div
          className={`flex items-center gap-3 ${disabledCls(form.personaInjectionPlacement !== 'endOfMessages' || form.personaInjectionTiming === 'never')}`}
        >
          <label className="text-sm text-text shrink-0">{t('personaInjectionMessageRole')}</label>
          <ButtonGroup
            options={PERSONA_MESSAGE_ROLE_OPTIONS}
            value={form.personaInjectionMessageRole}
            onChange={(v) => onChange('personaInjectionMessageRole', v)}
            disabled={
              form.personaInjectionPlacement !== 'endOfMessages' ||
              form.personaInjectionTiming === 'never'
            }
          />
        </div>
      </div>
    </div>
  )
}

export default OverridesSection
