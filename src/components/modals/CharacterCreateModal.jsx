import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { createCharacter } from '../../services/characters'
import CollapsibleSection from '../shared/CollapsibleSection'

function CharacterCreateModal() {
  const { t } = useTranslation('characterCreation')
  const { closeModal } = useModal()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    avatar: '',
    description: '',
    personality: '',
    greeting: '',
    scenario: '',
    sampleChat: '',
  })

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await createCharacter(form)
      window.dispatchEvent(new CustomEvent('characters-changed'))
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text">{t('title')}</h2>
        <button
          type="button"
          onClick={closeModal}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">{t('nameLabel')}</label>
          <input
            className={inputClass}
            value={form.name}
            onChange={update('name')}
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
            onChange={update('avatar')}
            placeholder={t('avatarPlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">{t('descriptionLabel')}</label>
          <textarea
            className={`${inputClass} resize-none`}
            rows={2}
            value={form.description}
            onChange={update('description')}
            placeholder={t('descriptionPlaceholder')}
          />
        </div>

        <CollapsibleSection label={t('personalityLabel')} storageKey="charCreatePersonality">
          <textarea
            className={`${inputClass} resize-none mt-2`}
            rows={4}
            value={form.personality}
            onChange={update('personality')}
            placeholder={t('personalityPlaceholder')}
          />
        </CollapsibleSection>

        <CollapsibleSection label={t('greetingLabel')} storageKey="charCreateGreeting">
          <textarea
            className={`${inputClass} resize-none mt-2`}
            rows={3}
            value={form.greeting}
            onChange={update('greeting')}
            placeholder={t('greetingPlaceholder')}
          />
        </CollapsibleSection>

        <CollapsibleSection label={t('scenarioLabel')} storageKey="charCreateScenario">
          <textarea
            className={`${inputClass} resize-none mt-2`}
            rows={3}
            value={form.scenario}
            onChange={update('scenario')}
            placeholder={t('scenarioPlaceholder')}
          />
        </CollapsibleSection>

        <CollapsibleSection label={t('sampleChatLabel')} storageKey="charCreateSampleChat">
          <textarea
            className={`${inputClass} resize-none mt-2`}
            rows={4}
            value={form.sampleChat}
            onChange={update('sampleChat')}
            placeholder={t('sampleChatPlaceholder')}
          />
        </CollapsibleSection>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
        <button
          type="button"
          onClick={closeModal}
          className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={saving || !form.name.trim()}
          className="min-h-[44px] px-6 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm disabled:opacity-50"
        >
          {saving ? t('save', 'Saving…') : t('save')}
        </button>
      </div>
    </form>
  )
}

export default CharacterCreateModal
