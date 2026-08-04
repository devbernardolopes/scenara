import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { showToast } from '../../lib/toast'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'
import Label from '../shared/Label'
import { createSamplingProfile } from '../../services/samplingProfiles'

const inputClass =
  'w-full flex-1 min-w-0 min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm'

function SamplingProfileSaveModal({ params, promptTemplate, promptTemplateCustom, suggestedName }) {
  const { t } = useTranslation('settings')
  const { closeModal } = useModal()
  const [name, setName] = useState(suggestedName || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await createSamplingProfile({
        name: name.trim(),
        params: params || {},
        promptTemplate,
        promptTemplateCustom,
      })
      showToast(t('common:toast.samplingProfile.created'), { type: 'success' })
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell
      title={t('samplingProfile.form.saveAsTitle')}
      onClose={closeModal}
      footer={
        <>
          <button
            type="button"
            onClick={closeModal}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('samplingProfile.form.cancel')}
          </button>
          <SaveButton
            isDirty={Boolean(name.trim())}
            saving={saving}
            disabled={!name.trim()}
            onClick={handleSave}
            savingText={t('samplingProfile.form.saving')}
          >
            {t('samplingProfile.form.save')}
          </SaveButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label required highlight={Boolean(name.trim())}>
            {t('samplingProfile.form.nameLabel')}
          </Label>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('samplingProfile.form.namePlaceholder')}
            required
            autoFocus
          />
        </div>
        <p className="text-xs text-secondary">{t('samplingProfile.form.saveAsHint')}</p>
      </div>
    </ModalShell>
  )
}

export default SamplingProfileSaveModal
