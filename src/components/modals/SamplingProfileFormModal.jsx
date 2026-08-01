import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'
import Label from '../shared/Label'
import { Plus, X } from '../../lib/icons'
import { createSamplingProfile, updateSamplingProfile } from '../../services/samplingProfiles'

const inputClass =
  'w-full flex-1 min-w-0 min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm'

function entriesFromParams(params) {
  return Object.entries(params || {}).map(([key, value]) => ({
    key,
    value: Array.isArray(value)
      ? value.join(', ')
      : typeof value === 'boolean'
        ? value
          ? 'true'
          : 'false'
        : value === null || value === undefined
          ? ''
          : String(value),
  }))
}

function SamplingProfileFormModal({ samplingProfile }) {
  const { t } = useTranslation('settings')
  const { closeModal, setCloseGuard } = useModal()
  const { promptSave } = useSaveConfirm()
  const editing = Boolean(samplingProfile)

  const initial = useMemo(
    () => ({
      name: samplingProfile?.name || '',
      entries: entriesFromParams(samplingProfile?.params),
    }),
    [],
  )

  const [form, setForm] = useState({ ...initial })
  const [saving, setSaving] = useState(false)
  const savePendingRef = useRef(false)

  const isDirty =
    form.name !== initial.name || JSON.stringify(form.entries) !== JSON.stringify(initial.entries)

  const handleCloseRef = useRef()
  useEffect(() => {
    handleCloseRef.current = handleCloseAttempt
  })

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

  function updateEntry(i, field, value) {
    setForm((prev) => {
      const next = [...prev.entries]
      next[i] = { ...next[i], [field]: value }
      return { ...prev, entries: next }
    })
  }

  function removeEntry(i) {
    setForm((prev) => ({ ...prev, entries: prev.entries.filter((_, idx) => idx !== i) }))
  }

  function addEntry() {
    setForm((prev) => ({ ...prev, entries: [...prev.entries, { key: '', value: '' }] }))
  }

  async function saveProfile() {
    const params = {}
    for (const entry of form.entries) {
      const key = entry.key.trim()
      if (!key) continue
      const value = entry.value.trim()
      if (value === '') continue
      params[key] = value
    }
    setSaving(true)
    try {
      if (editing) {
        await updateSamplingProfile(samplingProfile.id, {
          name: form.name.trim(),
          params,
        })
      } else {
        await createSamplingProfile({
          name: form.name.trim(),
          params,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim() || saving) return
    await saveProfile()
    closeModal()
  }

  async function handleCloseAttempt() {
    const result = await promptSave()
    if (result === 'save') {
      await saveProfile()
      closeModal()
    } else if (result === 'discard') {
      closeModal()
    }
  }

  return (
    <ModalShell
      title={editing ? t('samplingProfile.form.editTitle') : t('samplingProfile.form.title')}
      onClose={isDirty ? handleCloseAttempt : closeModal}
      footer={
        <>
          <button
            type="button"
            onClick={isDirty ? handleCloseAttempt : closeModal}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('samplingProfile.form.cancel')}
          </button>
          <SaveButton
            isDirty={isDirty}
            saving={saving}
            disabled={!form.name.trim()}
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
          <Label required highlight={Boolean(form.name.trim())}>
            {t('samplingProfile.form.nameLabel')}
          </Label>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder={t('samplingProfile.form.namePlaceholder')}
            required
          />
        </div>

        <div>
          <span className="block text-sm font-medium text-text mb-1.5">
            {t('samplingProfile.form.paramsLabel')}
          </span>
          <p className="text-xs text-secondary mb-3">{t('samplingProfile.form.paramsHint')}</p>
          <div className="space-y-2">
            {form.entries.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={inputClass}
                  value={entry.key}
                  onChange={(e) => updateEntry(i, 'key', e.target.value)}
                  placeholder={t('samplingProfile.form.keyPlaceholder')}
                />
                <input
                  className={inputClass}
                  value={entry.value}
                  onChange={(e) => updateEntry(i, 'value', e.target.value)}
                  placeholder={t('samplingProfile.form.valuePlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => removeEntry(i)}
                  title={t('samplingProfile.form.removeParam')}
                  className="min-h-[44px] px-2 text-secondary hover:text-on-delete hover:bg-delete-hover rounded-md shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addEntry}
            className="min-h-[44px] px-4 mt-2 text-sm border border-border rounded-md text-text hover:bg-surface-hover inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> {t('samplingProfile.form.addParam')}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

export default SamplingProfileFormModal
