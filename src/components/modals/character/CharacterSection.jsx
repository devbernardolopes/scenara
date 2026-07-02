import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import CollapsibleSection from '../../shared/CollapsibleSection'
import { estimateTokens } from '../../../services/tokenEstimator'
import Avatar from '../../shared/Avatar'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

function CharacterSection({ form, onChange, characterId }) {
  const { t } = useTranslation('characterCreation')
  const fileRef = useRef(null)

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result
      if (typeof dataUrl === 'string') {
        onChange('avatar', dataUrl)
      }
    }
    reader.readAsDataURL(file)
  }

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
        <div className="flex items-center gap-2">
          <Avatar src={form.avatar} size="xl" className="shrink-0" />
          <input
            className={`${inputClass} flex-1`}
            value={form.avatar}
            onChange={(e) => onChange('avatar', e.target.value)}
            placeholder={t('avatarPlaceholder')}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center border border-border rounded-md text-secondary hover:text-text hover:bg-surface-hover shrink-0"
            aria-label="Upload image"
            title="Upload image"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12"
              />
            </svg>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
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
