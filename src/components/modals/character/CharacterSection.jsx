import { useTranslation } from 'react-i18next'
import CollapsibleSection from '../../shared/CollapsibleSection'
import { estimateTokens } from '../../../services/tokenEstimator'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

function CharacterSection({ form, onChange, characterId }) {
  const { t } = useTranslation('characterCreation')

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text mb-1">{t('nameLabel')}</label>
        <input
          className={inputClass}
          value={form.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder={t('namePlaceholder')}
          required
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-1">{t('avatarLabel')}</label>
        <input
          className={inputClass}
          value={form.avatar}
          onChange={(e) => onChange('avatar', e.target.value)}
          placeholder={t('avatarPlaceholder')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-1">{t('descriptionLabel')}</label>
        <textarea
          className={`${inputClass} resize-none`}
          rows={2}
          value={form.description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder={t('descriptionPlaceholder')}
        />
      </div>

      <CollapsibleSection
        label={t('personalityLabel')}
        summary={form.personality ? `${estimateTokens(form.personality)} tokens` : null}
        storageKey={characterId ? `charSection.personality.${characterId}` : undefined}
        defaultExpanded={false}
      >
        <textarea
          className={`${inputClass} resize-none mt-2`}
          rows={4}
          value={form.personality}
          onChange={(e) => onChange('personality', e.target.value)}
          placeholder={t('personalityPlaceholder')}
        />
      </CollapsibleSection>

      <CollapsibleSection
        label={t('greetingLabel')}
        summary={form.greeting ? `${estimateTokens(form.greeting)} tokens` : null}
        storageKey={characterId ? `charSection.greeting.${characterId}` : undefined}
        defaultExpanded={false}
      >
        <textarea
          className={`${inputClass} resize-none mt-2`}
          rows={3}
          value={form.greeting}
          onChange={(e) => onChange('greeting', e.target.value)}
          placeholder={t('greetingPlaceholder')}
        />
      </CollapsibleSection>

      <CollapsibleSection
        label={t('scenarioLabel')}
        summary={form.scenario ? `${estimateTokens(form.scenario)} tokens` : null}
        storageKey={characterId ? `charSection.scenario.${characterId}` : undefined}
        defaultExpanded={false}
      >
        <textarea
          className={`${inputClass} resize-none mt-2`}
          rows={3}
          value={form.scenario}
          onChange={(e) => onChange('scenario', e.target.value)}
          placeholder={t('scenarioPlaceholder')}
        />
      </CollapsibleSection>

      <CollapsibleSection
        label={t('sampleChatLabel')}
        summary={form.sampleChat ? `${estimateTokens(form.sampleChat)} tokens` : null}
        storageKey={characterId ? `charSection.sampleChat.${characterId}` : undefined}
        defaultExpanded={false}
      >
        <textarea
          className={`${inputClass} resize-none mt-2`}
          rows={4}
          value={form.sampleChat}
          onChange={(e) => onChange('sampleChat', e.target.value)}
          placeholder={t('sampleChatPlaceholder')}
        />
      </CollapsibleSection>
    </div>
  )
}

export default CharacterSection
