import { useTranslation } from 'react-i18next'
import CollapsibleSection from '../../shared/CollapsibleSection'
import { estimateTokens } from '../../../services/tokenEstimator'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'
const numberClass =
  'w-24 px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

const AVATAR_SCALE_OPTIONS = ['1x', '2x', '3x', '4x']

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
            min={0}
          />
        </div>

        <CollapsibleSection
          label={t('autoTitleSystemInstructions')}
          summary={
            form.autoTitleSystemInstructions
              ? `${estimateTokens(form.autoTitleSystemInstructions)} tokens`
              : null
          }
          storageKey={characterId ? `charSection.autoTitleSystem.${characterId}` : undefined}
          defaultExpanded={false}
        >
          <textarea
            className={`${inputClass} resize-none mt-2`}
            rows={5}
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
              ? `${estimateTokens(form.autoTitleUserInstructions)} tokens`
              : null
          }
          storageKey={characterId ? `charSection.autoTitleUser.${characterId}` : undefined}
          defaultExpanded={false}
        >
          <textarea
            className={`${inputClass} resize-none mt-2`}
            rows={5}
            value={form.autoTitleUserInstructions}
            onChange={(e) => onChange('autoTitleUserInstructions', e.target.value)}
            placeholder={t('autoTitleUserInstructionsPlaceholder')}
            disabled={!form.autoTitle}
          />
        </CollapsibleSection>
      </div>

      <hr className="border-border" />

      <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
        <input
          type="checkbox"
          checked={form.memory}
          onChange={(e) => onChange('memory', e.target.checked)}
          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
        />
        <span className="text-sm text-text">{t('memory')}</span>
      </label>

      <div className={`ml-7 space-y-4 ${disabledCls(!form.memory)}`}>
        <div className="flex items-center gap-3">
          <label className="text-sm text-secondary shrink-0">{t('memoryThreshold')}</label>
          <input
            type="number"
            className={numberClass}
            value={form.memoryThreshold}
            onChange={(e) => onChange('memoryThreshold', Number(e.target.value))}
            disabled={!form.memory}
            min={0}
          />
        </div>

        <CollapsibleSection
          label={t('summarizationSystemInstructions')}
          summary={
            form.summarizationSystemInstructions
              ? `${estimateTokens(form.summarizationSystemInstructions)} tokens`
              : null
          }
          storageKey={characterId ? `charSection.summarizationSystem.${characterId}` : undefined}
          defaultExpanded={false}
        >
          <textarea
            className={`${inputClass} resize-none mt-2`}
            rows={5}
            value={form.summarizationSystemInstructions}
            onChange={(e) => onChange('summarizationSystemInstructions', e.target.value)}
            placeholder={t('summarizationSystemInstructionsPlaceholder')}
            disabled={!form.memory}
          />
        </CollapsibleSection>

        <CollapsibleSection
          label={t('summarizationUserInstructions')}
          summary={
            form.summarizationUserInstructions
              ? `${estimateTokens(form.summarizationUserInstructions)} tokens`
              : null
          }
          storageKey={characterId ? `charSection.summarizationUser.${characterId}` : undefined}
          defaultExpanded={false}
        >
          <textarea
            className={`${inputClass} resize-none mt-2`}
            rows={5}
            value={form.summarizationUserInstructions}
            onChange={(e) => onChange('summarizationUserInstructions', e.target.value)}
            placeholder={t('summarizationUserInstructionsPlaceholder')}
            disabled={!form.memory}
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

      <div className="flex items-center gap-3 min-h-[44px]">
        <label className="text-sm text-text shrink-0">{t('characterAvatarScale')}</label>
        <select
          value={form.characterAvatarScale}
          onChange={(e) => onChange('characterAvatarScale', e.target.value)}
          className="px-3 py-2 border border-border rounded-md bg-surface text-text text-sm min-w-[80px]"
        >
          {AVATAR_SCALE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3 min-h-[44px]">
        <label className="text-sm text-text shrink-0">{t('userPersonaAvatarScale')}</label>
        <select
          value={form.userPersonaAvatarScale}
          onChange={(e) => onChange('userPersonaAvatarScale', e.target.value)}
          className="px-3 py-2 border border-border rounded-md bg-surface text-text text-sm min-w-[80px]"
        >
          {AVATAR_SCALE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default OverridesSection
