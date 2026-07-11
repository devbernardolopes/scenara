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

function Toggle({ checked, onChange, disabled, label }) {
  return (
    <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 rounded border-border text-primary focus:ring-primary disabled:cursor-not-allowed"
      />
      <span className="text-sm text-text">{label}</span>
    </label>
  )
}

function Group({ group, form, onChange, characterId }) {
  const { t } = useTranslation('characterCreation')
  const groupEnabled = form[group.enabledKey]
  const instructions = form[group.instructionsKey]

  return (
    <CollapsibleSection
      label={t(group.labelKey)}
      storageKey={characterId ? `${group.storageBase}.${characterId}` : undefined}
      defaultExpanded={false}
    >
      <div className="space-y-3">
        <Toggle
          checked={groupEnabled}
          onChange={(val) => onChange(group.enabledKey, val)}
          label={t('directorGroupEnable')}
        />

        <div className={`${!groupEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
          <CollapsibleSection
            label={t(group.instructionsLabelKey)}
            summary={
              instructions ? t('common:tokenCount', { count: estimateTokens(instructions) }) : null
            }
            hasContent={!!instructions}
            storageKey={
              characterId ? `${group.storageBase}.instructions.${characterId}` : undefined
            }
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
    </CollapsibleSection>
  )
}

function DirectorSection({ form, onChange, characterId }) {
  const { t } = useTranslation('characterCreation')
  const directorEnabled = form.directorEnabled
  const disabledCls = (disabled) => (disabled ? 'opacity-40 pointer-events-none' : '')

  return (
    <div className="space-y-5">
      <Toggle
        checked={directorEnabled}
        onChange={(val) => onChange('directorEnabled', val)}
        label={t('directorEnable')}
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
