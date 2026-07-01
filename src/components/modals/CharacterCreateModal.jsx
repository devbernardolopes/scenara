import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import { createCharacter, updateCharacter } from '../../services/characters'
import CollapsibleSection from '../shared/CollapsibleSection'
import CloseButton from '../shared/CloseButton'

function CharacterCreateModal({ character: existing }) {
  const { t } = useTranslation('characterCreation')
  const { closeModal, setCloseGuard } = useModal()
  const { promptSave } = useSaveConfirm()
  const isEditing = Boolean(existing)

  const initialRef = useRef({
    name: existing?.name || '',
    avatar: existing?.avatar || '',
    description: existing?.description || '',
    personality: existing?.personality || '',
    greeting: existing?.greeting || '',
    scenario: existing?.scenario || '',
    sampleChat: existing?.sampleChat || '',
  })

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...initialRef.current })

  const isDirty = Object.keys(initialRef.current).some(
    (key) => form[key] !== initialRef.current[key],
  )

  const handleCloseRef = useRef()
  handleCloseRef.current = handleCloseAttempt

  const savePendingRef = useRef(false)

  useEffect(() => {
    if (isDirty) {
      setCloseGuard(() => {
        if (savePendingRef.current) return false
        savePendingRef.current = true
        handleCloseRef.current().finally(() => {
          savePendingRef.current = false
        })
        return false
      })
    } else {
      setCloseGuard(null)
    }
    return () => setCloseGuard(null)
  }, [isDirty, setCloseGuard])

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function saveCharacter() {
    setSaving(true)
    try {
      if (isEditing) {
        await updateCharacter(existing.id, form)
      } else {
        await createCharacter(form)
      }
      window.dispatchEvent(new CustomEvent('characters-changed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    await saveCharacter()
    closeModal()
  }

  async function handleCloseAttempt() {
    const result = await promptSave()
    if (result === 'save') {
      await saveCharacter()
      closeModal()
    } else if (result === 'discard') {
      closeModal()
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text">{isEditing ? t('editTitle') : t('title')}</h2>
        <CloseButton onClick={isDirty ? handleCloseAttempt : closeModal} />
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
            onClick={isDirty ? handleCloseAttempt : closeModal}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('cancel')}
          </button>
        <button
          type="submit"
          disabled={saving || !form.name.trim()}
          className="min-h-[44px] px-6 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm disabled:opacity-50"
        >
          {saving ? (isEditing ? 'Saving…' : t('save')) : t('save')}
        </button>
      </div>
    </form>
  )
}

export default CharacterCreateModal
