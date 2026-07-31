import { useTranslation } from 'react-i18next'
import CollapsibleSection from '../../shared/CollapsibleSection'
import AutoResizeTextarea from '../../shared/AutoResizeTextarea'
import PromptBankButton from '../../shared/PromptBankButton'
import { estimateTokens } from '../../../services/tokenEstimator'
import { getSetting } from '../../../services/settings'
import { useConfirm } from '../../../lib/confirm'
import { RefreshCw } from '../../../lib/icons'
import SettingSlider from '../settings/controls/SettingSlider'
import SettingToggle from '../settings/controls/SettingToggle'
import SettingSelect from '../settings/controls/SettingSelect'
import SettingButtonGroup from '../settings/controls/SettingButtonGroup'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm'

const MEMORY_OPTION_LABELS = {
  never: 'settings:defaults.memoryOptions.never',
  messages: 'settings:defaults.memoryOptions.messages',
  contextWindow: 'settings:defaults.memoryOptions.contextWindow',
}

const AVATAR_SCALE_OPTIONS = ['1x', '2x', '3x', '4x']

const WRITING_INJECTION_OPTION_LABELS = {
  always: 'settings:defaults.writingInjectionTimingOptions.always',
  never: 'settings:defaults.writingInjectionTimingOptions.never',
}

const WRITING_PLACEMENT_OPTION_LABELS = {
  endOfSystemPrompt: 'settings:defaults.writingPlacementOptions.endOfSystemPrompt',
  endOfMessages: 'settings:defaults.writingPlacementOptions.endOfMessages',
}

const WRITING_MESSAGE_ROLE_OPTION_LABELS = {
  system: 'settings:defaults.writingMessageRoleOptions.system',
  assistant: 'settings:defaults.writingMessageRoleOptions.assistant',
}

const PERSONA_INJECTION_OPTION_LABELS = {
  always: 'settings:defaults.personaInjectionTimingOptions.always',
  never: 'settings:defaults.personaInjectionTimingOptions.never',
}

const PERSONA_PLACEMENT_OPTION_LABELS = {
  endOfSystemPrompt: 'settings:defaults.personaInjectionPlacementOptions.endOfSystemPrompt',
  endOfCharacterPrompt: 'settings:defaults.personaInjectionPlacementOptions.endOfCharacterPrompt',
  endOfMessages: 'settings:defaults.personaInjectionPlacementOptions.endOfMessages',
}

const PERSONA_MESSAGE_ROLE_OPTION_LABELS = {
  system: 'settings:defaults.personaInjectionMessageRoleOptions.system',
  assistant: 'settings:defaults.personaInjectionMessageRoleOptions.assistant',
}

const FIRST_MESSAGE_ROLE_OPTION_LABELS = {
  system: 'settings:prompting.firstMessageRoleOptions.system',
  assistant: 'settings:prompting.firstMessageRoleOptions.assistant',
  user: 'settings:prompting.firstMessageRoleOptions.user',
}

const CONTINUE_ROLE_OPTION_LABELS = {
  system: 'settings:prompting.continueRoleOptions.system',
  assistant: 'settings:prompting.continueRoleOptions.assistant',
  user: 'settings:prompting.continueRoleOptions.user',
}

const ROLLOVER_BUTTONS = [
  { value: 'rollover', labelKey: 'settings:defaults.messageRollover.options.rollover' },
  { value: 'static', labelKey: 'settings:defaults.messageRollover.options.static' },
]

// Maps each Overrides form field to its counterpart in Settings > Defaults.
const OVERRIDE_DEFAULTS_MAP = [
  ['autoTitle', 'defaultAutoTitle'],
  ['autoTitleThreshold', 'defaultAutoTitleThreshold'],
  ['memory', 'defaultMemory'],
  ['messagesThreshold', 'defaultMessagesThreshold'],
  ['contextWindowThreshold', 'defaultContextWindowThreshold'],
  ['messagesToKeep', 'defaultMessagesToKeep'],
  ['messageRollover', 'defaultMessageRollover'],
  ['memorySlots', 'defaultMemorySlots'],
  ['firstMessage', 'defaultFirstMessage'],
  ['userPersonaPrefix', 'defaultUserPersonaPrefix'],
  ['includeOOC', 'defaultIncludeOOC'],
  ['removeMarkdownImages', 'defaultRemoveMarkdownImages'],
  ['systemAvatarScale', 'defaultSystemAvatarScale'],
  ['characterAvatarScale', 'defaultCharacterAvatarScale'],
  ['userPersonaAvatarScale', 'defaultUserPersonaAvatarScale'],
  ['writingInjectionTiming', 'prompting.writingInjectionTiming'],
  ['writingPlacement', 'prompting.writingPlacement'],
  ['writingMessageRole', 'prompting.writingMessageRole'],
  ['personaInjectionTiming', 'prompting.personaInjectionTiming'],
  ['personaInjectionPlacement', 'prompting.personaInjectionPlacement'],
  ['personaInjectionMessageRole', 'prompting.personaInjectionMessageRole'],
  ['firstMessageRole', 'prompting.firstMessageRole'],
  ['firstMessagePrompt', 'prompting.firstMessagePrompt'],
  ['continueRole', 'prompting.continueRole'],
  ['continuePrompt', 'prompting.continuePrompt'],
]

function OverridesSection({ form, onChange, characterId }) {
  const { t } = useTranslation('characterCreation')
  const { confirm } = useConfirm()

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
    onChange('autoTitleSystemInstructions', '')
    onChange('autoTitleUserInstructions', '')
    onChange('summarizationSystemInstructions', '')
    onChange('summarizationUserInstructions', '')
    onChange('firstMessagePrompt', '')
    onChange('continuePrompt', '')
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

      <div className="flex items-center justify-between gap-3 min-h-[44px]">
        <span className="text-sm text-text">{t('autoTitle')}</span>
        <SettingToggle value={form.autoTitle} onChange={(v) => onChange('autoTitle', v)} />
      </div>

      <div className={`space-y-4 ${!form.autoTitle ? 'opacity-50' : ''}`}>
        <div className="space-y-2">
          <span className="text-sm text-text">{t('autoTitleThreshold')}</span>
          <SettingSlider
            value={form.autoTitleThreshold}
            onChange={(v) => onChange('autoTitleThreshold', v)}
            min={1}
            max={10}
            step={1}
            disabled={!form.autoTitle}
            label={t('autoTitleThreshold')}
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
          headerExtra={
            <PromptBankButton
              onSelect={(content) => onChange('autoTitleSystemInstructions', content)}
            />
          }
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
          headerExtra={
            <PromptBankButton
              onSelect={(content) => onChange('autoTitleUserInstructions', content)}
            />
          }
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

      <div className="space-y-2">
        <span className="text-sm text-text">{t('memory')}</span>
        <SettingSelect
          value={form.memory}
          options={['never', 'messages', 'contextWindow']}
          optionLabels={MEMORY_OPTION_LABELS}
          onChange={(v) => onChange('memory', v)}
        />
      </div>

      <div className={`space-y-4 ${form.memory !== 'messages' ? 'opacity-50' : ''}`}>
        <div className="space-y-2">
          <span className="text-sm text-text">{t('messagesThreshold')}</span>
          <SettingSlider
            value={form.messagesThreshold}
            onChange={(v) => onChange('messagesThreshold', v)}
            min={3}
            max={50}
            step={1}
            disabled={form.memory !== 'messages'}
            label={t('messagesThreshold')}
          />
        </div>
      </div>

      <div className={`space-y-4 ${form.memory !== 'contextWindow' ? 'opacity-50' : ''}`}>
        <div className="space-y-2">
          <span className="text-sm text-text">{t('contextWindowThreshold')}</span>
          <SettingSlider
            value={form.contextWindowThreshold}
            onChange={(v) => onChange('contextWindowThreshold', v)}
            min={256}
            max={8192}
            step={128}
            disabled={form.memory !== 'contextWindow'}
            label={t('contextWindowThreshold')}
          />
        </div>
      </div>

      <div className={`space-y-4 ${form.memory === 'never' ? 'opacity-50' : ''}`}>
        <div className="space-y-2">
          <span className="text-sm text-text">{t('messagesToKeep')}</span>
          <SettingSlider
            value={form.messagesToKeep}
            onChange={(v) => onChange('messagesToKeep', v)}
            min={0}
            max={25}
            step={1}
            disabled={form.memory === 'never'}
            label={t('messagesToKeep')}
          />
        </div>

        <div className="space-y-2">
          <span className="text-sm text-text">{t('messageRollover')}</span>
          <SettingButtonGroup
            value={form.messageRollover}
            buttons={ROLLOVER_BUTTONS}
            onChange={(v) => onChange('messageRollover', v)}
            disabled={form.memory === 'never' || form.messagesToKeep === 0}
          />
        </div>

        <div className="space-y-2">
          <span className="text-sm text-text">{t('memorySlots')}</span>
          <SettingSlider
            value={form.memorySlots}
            onChange={(v) => onChange('memorySlots', v)}
            min={1}
            max={5}
            step={1}
            disabled={form.memory === 'never'}
            label={t('memorySlots')}
          />
        </div>
      </div>

      <div className={`space-y-4 ${form.memory === 'never' ? 'opacity-50' : ''}`}>
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
          headerExtra={
            <PromptBankButton
              onSelect={(content) => onChange('summarizationSystemInstructions', content)}
            />
          }
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
          headerExtra={
            <PromptBankButton
              onSelect={(content) => onChange('summarizationUserInstructions', content)}
            />
          }
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

      <div className="flex items-center justify-between gap-3 min-h-[44px]">
        <span className="text-sm text-text">{t('firstMessage')}</span>
        <SettingToggle value={form.firstMessage} onChange={(v) => onChange('firstMessage', v)} />
      </div>

      <div className="flex items-center justify-between gap-3 min-h-[44px]">
        <span className="text-sm text-text">{t('userPersonaPrefix')}</span>
        <SettingToggle
          value={form.userPersonaPrefix}
          onChange={(v) => onChange('userPersonaPrefix', v)}
        />
      </div>

      <div className="flex items-center justify-between gap-3 min-h-[44px]">
        <span className="text-sm text-text">{t('includeOOC')}</span>
        <SettingToggle value={form.includeOOC} onChange={(v) => onChange('includeOOC', v)} />
      </div>

      <div className="flex items-center justify-between gap-3 min-h-[44px]">
        <span className="text-sm text-text">{t('removeMarkdownImages')}</span>
        <SettingToggle
          value={form.removeMarkdownImages}
          onChange={(v) => onChange('removeMarkdownImages', v)}
        />
      </div>

      <div className="space-y-2">
        <span className="text-sm text-text">{t('systemAvatarScale')}</span>
        <SettingSelect
          value={form.systemAvatarScale}
          options={AVATAR_SCALE_OPTIONS}
          onChange={(v) => onChange('systemAvatarScale', v)}
        />
      </div>

      <div className="space-y-2">
        <span className="text-sm text-text">{t('characterAvatarScale')}</span>
        <SettingSelect
          value={form.characterAvatarScale}
          options={AVATAR_SCALE_OPTIONS}
          onChange={(v) => onChange('characterAvatarScale', v)}
        />
      </div>

      <div className="space-y-2">
        <span className="text-sm text-text">{t('userPersonaAvatarScale')}</span>
        <SettingSelect
          value={form.userPersonaAvatarScale}
          options={AVATAR_SCALE_OPTIONS}
          onChange={(v) => onChange('userPersonaAvatarScale', v)}
        />
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <span className="text-sm text-text">{t('writingInjectionTiming')}</span>
          <SettingSelect
            value={form.writingInjectionTiming}
            options={['always', 'never']}
            optionLabels={WRITING_INJECTION_OPTION_LABELS}
            onChange={(v) => onChange('writingInjectionTiming', v)}
          />
        </div>

        <div className={`space-y-2 ${form.writingInjectionTiming === 'never' ? 'opacity-50' : ''}`}>
          <span className="text-sm text-text">{t('writingPlacement')}</span>
          <SettingSelect
            value={form.writingPlacement}
            options={['endOfSystemPrompt', 'endOfMessages']}
            optionLabels={WRITING_PLACEMENT_OPTION_LABELS}
            onChange={(v) => onChange('writingPlacement', v)}
            disabled={form.writingInjectionTiming === 'never'}
          />
        </div>

        <div
          className={`space-y-2 ${form.writingPlacement !== 'endOfMessages' || form.writingInjectionTiming === 'never' ? 'opacity-50' : ''}`}
        >
          <span className="text-sm text-text">{t('writingMessageRole')}</span>
          <SettingSelect
            value={form.writingMessageRole}
            options={['system', 'assistant']}
            optionLabels={WRITING_MESSAGE_ROLE_OPTION_LABELS}
            onChange={(v) => onChange('writingMessageRole', v)}
            disabled={
              form.writingPlacement !== 'endOfMessages' || form.writingInjectionTiming === 'never'
            }
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <span className="text-sm text-text">{t('personaInjectionTiming')}</span>
          <SettingSelect
            value={form.personaInjectionTiming}
            options={['always', 'never']}
            optionLabels={PERSONA_INJECTION_OPTION_LABELS}
            onChange={(v) => onChange('personaInjectionTiming', v)}
          />
        </div>

        <div className={`space-y-2 ${form.personaInjectionTiming === 'never' ? 'opacity-50' : ''}`}>
          <span className="text-sm text-text">{t('personaInjectionPlacement')}</span>
          <SettingSelect
            value={form.personaInjectionPlacement}
            options={['endOfSystemPrompt', 'endOfCharacterPrompt', 'endOfMessages']}
            optionLabels={PERSONA_PLACEMENT_OPTION_LABELS}
            onChange={(v) => onChange('personaInjectionPlacement', v)}
            disabled={form.personaInjectionTiming === 'never'}
          />
        </div>

        <div
          className={`space-y-2 ${form.personaInjectionPlacement !== 'endOfMessages' || form.personaInjectionTiming === 'never' ? 'opacity-50' : ''}`}
        >
          <span className="text-sm text-text">{t('personaInjectionMessageRole')}</span>
          <SettingSelect
            value={form.personaInjectionMessageRole}
            options={['system', 'assistant']}
            optionLabels={PERSONA_MESSAGE_ROLE_OPTION_LABELS}
            onChange={(v) => onChange('personaInjectionMessageRole', v)}
            disabled={
              form.personaInjectionPlacement !== 'endOfMessages' ||
              form.personaInjectionTiming === 'never'
            }
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <span className="text-sm text-text">{t('firstMessageRole')}</span>
          <SettingSelect
            value={form.firstMessageRole}
            options={['system', 'assistant', 'user']}
            optionLabels={FIRST_MESSAGE_ROLE_OPTION_LABELS}
            onChange={(v) => onChange('firstMessageRole', v)}
          />
        </div>

        <CollapsibleSection
          label={t('firstMessagePrompt')}
          summary={
            form.firstMessagePrompt
              ? t('common:tokenCount', { count: estimateTokens(form.firstMessagePrompt) })
              : null
          }
          storageKey={characterId ? `charSection.firstMessagePrompt.${characterId}` : undefined}
          defaultExpanded={false}
          headerExtra={
            <PromptBankButton onSelect={(content) => onChange('firstMessagePrompt', content)} />
          }
        >
          <AutoResizeTextarea
            className={`${inputClass} resize-none mt-2`}
            value={form.firstMessagePrompt}
            onChange={(e) => onChange('firstMessagePrompt', e.target.value)}
            placeholder={t('firstMessagePromptPlaceholder')}
            extraHeight={8}
          />
        </CollapsibleSection>

        <div className="space-y-2">
          <span className="text-sm text-text">{t('continueRole')}</span>
          <SettingSelect
            value={form.continueRole}
            options={['system', 'assistant', 'user']}
            optionLabels={CONTINUE_ROLE_OPTION_LABELS}
            onChange={(v) => onChange('continueRole', v)}
          />
        </div>

        <CollapsibleSection
          label={t('continuePrompt')}
          summary={
            form.continuePrompt
              ? t('common:tokenCount', { count: estimateTokens(form.continuePrompt) })
              : null
          }
          storageKey={characterId ? `charSection.continuePrompt.${characterId}` : undefined}
          defaultExpanded={false}
          headerExtra={
            <PromptBankButton onSelect={(content) => onChange('continuePrompt', content)} />
          }
        >
          <AutoResizeTextarea
            className={`${inputClass} resize-none mt-2`}
            value={form.continuePrompt}
            onChange={(e) => onChange('continuePrompt', e.target.value)}
            placeholder={t('continuePromptPlaceholder')}
            extraHeight={8}
          />
        </CollapsibleSection>
      </div>
    </div>
  )
}

export default OverridesSection
