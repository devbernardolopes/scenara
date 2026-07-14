import { useTranslation } from 'react-i18next'
import CollapsibleSection from '../../shared/CollapsibleSection'
import AutoResizeTextarea from '../../shared/AutoResizeTextarea'
import { estimateTokens } from '../../../services/tokenEstimator'
import { getSetting } from '../../../services/settings'
import { useConfirm } from '../../../lib/confirm'
import { RefreshCw } from '../../../lib/icons'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

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

// Maps each Overrides form field to its counterpart in Settings > Defaults.
// Settings > Defaults contains more settings than the Overrides section, so only
// the fields with a matching key are reset (copied from the global defaults).
const OVERRIDE_DEFAULTS_MAP = [
  ['autoTitle', 'defaultAutoTitle'],
  ['autoTitleThreshold', 'defaultAutoTitleThreshold'],
  ['memory', 'defaultMemory'],
  ['messagesThreshold', 'defaultMessagesThreshold'],
  ['contextWindowThreshold', 'defaultContextWindowThreshold'],
  ['messagesToKeep', 'defaultMessagesToKeep'],
  ['memorySlots', 'defaultMemorySlots'],
  ['firstMessage', 'defaultFirstMessage'],
  ['userPersonaPrefix', 'defaultUserPersonaPrefix'],
  ['includeOOC', 'defaultIncludeOOC'],
  ['systemAvatarScale', 'defaultSystemAvatarScale'],
  ['characterAvatarScale', 'defaultCharacterAvatarScale'],
  ['userPersonaAvatarScale', 'defaultUserPersonaAvatarScale'],
  ['writingInjectionTiming', 'prompting.writingInjectionTiming'],
  ['writingPlacement', 'prompting.writingPlacement'],
  ['writingMessageRole', 'prompting.writingMessageRole'],
  ['personaInjectionTiming', 'prompting.personaInjectionTiming'],
  ['personaInjectionPlacement', 'prompting.personaInjectionPlacement'],
  ['personaInjectionMessageRole', 'prompting.personaInjectionMessageRole'],
]

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
      <span className="text-sm text-text">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
          checked ? 'bg-primary' : 'bg-gray-300'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}

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
  const { confirm } = useConfirm()

  const disabledCls = (disabled) => (disabled ? 'opacity-40 pointer-events-none' : '')

  async function handleReset() {
    const ok = await confirm({
      title: t('resetConfirmTitle'),
      message: t('resetConfirmMessage'),
      confirmLabel: t('reset'),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (!ok) return
    const values = await Promise.all(
      OVERRIDE_DEFAULTS_MAP.map(([, defaultsKey]) => getSetting(defaultsKey)),
    )
    OVERRIDE_DEFAULTS_MAP.forEach(([field], i) => onChange(field, values[i]))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="min-h-[44px] px-4 py-2 rounded-md text-sm font-medium border border-border bg-surface text-secondary hover:bg-surface-hover inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t('reset')}
        </button>
      </div>

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
            type="range"
            min={1}
            max={10}
            step={1}
            value={form.autoTitleThreshold}
            onChange={(e) => onChange('autoTitleThreshold', Number(e.target.value))}
            disabled={!form.autoTitle}
            className="w-48 accent-primary"
          />
          <span className="text-sm text-text font-medium w-14 text-right">
            {form.autoTitleThreshold}
          </span>
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
            extraHeight={8}
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
            extraHeight={8}
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
            type="range"
            min={3}
            max={50}
            step={1}
            value={form.messagesThreshold}
            onChange={(e) => onChange('messagesThreshold', Number(e.target.value))}
            disabled={form.memory !== 'messages'}
            className="w-48 accent-primary"
          />
          <span className="text-sm text-text font-medium w-14 text-right">
            {form.messagesThreshold}
          </span>
        </div>
      </div>

      <div className={`ml-7 space-y-4 ${disabledCls(form.memory !== 'contextWindow')}`}>
        <div className="flex items-center gap-3">
          <label className="text-sm text-secondary shrink-0">{t('contextWindowThreshold')}</label>
          <input
            type="range"
            min={256}
            max={8192}
            step={128}
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
            type="range"
            min={0}
            max={25}
            step={1}
            value={form.messagesToKeep}
            onChange={(e) => onChange('messagesToKeep', Number(e.target.value))}
            disabled={form.memory === 'never'}
            className="w-48 accent-primary"
          />
          <span className="text-sm text-text font-medium w-14 text-right">
            {form.messagesToKeep}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-secondary shrink-0">{t('memorySlots')}</label>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={form.memorySlots}
            onChange={(e) => onChange('memorySlots', Number(e.target.value))}
            disabled={form.memory === 'never'}
            className="w-48 accent-primary"
          />
          <span className="text-sm text-text font-medium w-14 text-right">{form.memorySlots}</span>
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
            extraHeight={8}
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
            extraHeight={8}
          />
        </CollapsibleSection>
      </div>

      <hr className="border-border" />

      <ToggleRow
        label={t('firstMessage')}
        checked={form.firstMessage}
        onChange={(v) => onChange('firstMessage', v)}
      />

      <ToggleRow
        label={t('userPersonaPrefix')}
        checked={form.userPersonaPrefix}
        onChange={(v) => onChange('userPersonaPrefix', v)}
      />

      <ToggleRow
        label={t('includeOOC')}
        checked={form.includeOOC}
        onChange={(v) => onChange('includeOOC', v)}
      />

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
