import { useTranslation } from 'react-i18next'
import CollapsibleSection from '../../shared/CollapsibleSection'
import AutoResizeTextarea from '../../shared/AutoResizeTextarea'
import { estimateTokens } from '../../../services/tokenEstimator'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

const GROUPS = [
  {
    id: 'autoTitle',
    labelKey: 'directorGroupAutoTitle',
    enabledKey: 'directorAutoTitleEnabled',
    instructionsKey: 'directorAutoTitleInstructions',
    instructionsLabelKey: 'directorAutoTitleInstructions',
    placeholderKey: 'directorAutoTitleInstructionsPlaceholder',
    storageBase: 'charSection.directorAutoTitle',
  },
  {
    id: 'summarization',
    labelKey: 'directorGroupSummarization',
    enabledKey: 'directorSummarizationEnabled',
    instructionsKey: 'directorSummarizationInstructions',
    instructionsLabelKey: 'directorSummarizationInstructions',
    placeholderKey: 'directorSummarizationInstructionsPlaceholder',
    storageBase: 'charSection.directorSummarization',
  },
  {
    id: 'regularChat',
    labelKey: 'directorGroupRegularChat',
    enabledKey: 'directorRegularChatEnabled',
    instructionsKey: 'directorRegularChatInstructions',
    instructionsLabelKey: 'directorRegularChatInstructions',
    placeholderKey: 'directorRegularChatInstructionsPlaceholder',
    storageBase: 'charSection.directorRegularChat',
  },
  {
    id: 'ooc',
    labelKey: 'directorGroupOOC',
    enabledKey: 'directorOOCEnabled',
    instructionsKey: 'directorOOCInstructions',
    instructionsLabelKey: 'directorOOCInstructions',
    placeholderKey: 'directorOOCInstructionsPlaceholder',
    storageBase: 'charSection.directorOOC',
  },
]

function Switch({ checked, onChange, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={ariaLabel}
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
  )
}

function SwitchRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-[44px]">
      <span className="text-sm text-text">{label}</span>
      <Switch checked={checked} onChange={onChange} ariaLabel={label} />
    </div>
  )
}

function Group({ group, form, onChange, characterId }) {
  const { t } = useTranslation('characterCreation')
  const groupEnabled = form[group.enabledKey]
  const instructions = form[group.instructionsKey]

  return (
    <div className="border border-border rounded-md">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <span className="text-sm font-medium text-text">{t(group.labelKey)}</span>
        <Switch
          checked={groupEnabled}
          onChange={(val) => onChange(group.enabledKey, val)}
          ariaLabel={t(group.labelKey)}
        />
      </div>

      <div className={`px-3 pb-3 ${!groupEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <CollapsibleSection
          label={t(group.instructionsLabelKey)}
          summary={
            instructions ? t('common:tokenCount', { count: estimateTokens(instructions) }) : null
          }
          hasContent={!!instructions}
          storageKey={characterId ? `${group.storageBase}.instructions.${characterId}` : undefined}
          defaultExpanded={false}
        >
          <AutoResizeTextarea
            className={`${inputClass} resize-none mt-2`}
            value={instructions}
            onChange={(e) => onChange(group.instructionsKey, e.target.value)}
            placeholder={t(group.placeholderKey)}
            disabled={!groupEnabled}
          />
        </CollapsibleSection>
      </div>
    </div>
  )
}

function DirectorSection({ form, onChange, characterId }) {
  const { t } = useTranslation('characterCreation')
  const directorEnabled = form.directorEnabled
  const disabledCls = (disabled) => (disabled ? 'opacity-40 pointer-events-none' : '')

  return (
    <div className="space-y-5">
      <SwitchRow
        label={t('directorEnable')}
        checked={directorEnabled}
        onChange={(val) => onChange('directorEnabled', val)}
      />

      <div className={disabledCls(!directorEnabled)}>
        {GROUPS.map((group) => (
          <Group
            key={group.id}
            group={group}
            form={form}
            onChange={onChange}
            characterId={characterId}
          />
        ))}
      </div>
    </div>
  )
}

export default DirectorSection
