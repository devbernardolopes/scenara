import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'
import Label from '../shared/Label'
import StringListInput from './profile/StringListInput'
import { createStopSequence, updateStopSequence } from '../../services/stopSequences'

const inputClass =
  'w-full px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm'

function StopSequenceFormModal({ stopSequence }) {
  const { t } = useTranslation('settings')
  const { closeModal, setCloseGuard } = useModal()
  const { promptSave } = useSaveConfirm()
  const editing = Boolean(stopSequence)

  const initial = useMemo(
    () => ({
      name: stopSequence?.name || '',
      sequences: stopSequence?.sequences ? [...stopSequence.sequences] : [],
    }),
    [],
  )

  const [form, setForm] = useState({ ...initial })
  const [saving, setSaving] = useState(false)
  const savePendingRef = useRef(false)

  const isDirty =
    form.name !== initial.name ||
    JSON.stringify(form.sequences) !== JSON.stringify(initial.sequences)

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

  async function saveSet() {
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        sequences: form.sequences,
      }
      if (editing) {
        await updateStopSequence(stopSequence.id, data)
      } else {
        await createStopSequence(data)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim() || saving) return
    await saveSet()
    closeModal()
  }

  async function handleCloseAttempt() {
    const result = await promptSave()
    if (result === 'save') {
      await saveSet()
      closeModal()
    } else if (result === 'discard') {
      closeModal()
    }
  }

  return (
    <ModalShell
      title={editing ? t('stopSequence.form.editTitle') : t('stopSequence.form.title')}
      onClose={isDirty ? handleCloseAttempt : closeModal}
      footer={
        <>
          <button
            type="button"
            onClick={isDirty ? handleCloseAttempt : closeModal}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('stopSequence.form.cancel')}
          </button>
          <SaveButton
            isDirty={isDirty}
            saving={saving}
            disabled={!form.name.trim()}
            onClick={handleSave}
            savingText={t('stopSequence.form.saving')}
          >
            {t('stopSequence.form.save')}
          </SaveButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label required highlight={Boolean(form.name.trim())}>
            {t('stopSequence.form.nameLabel')}
          </Label>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder={t('stopSequence.form.namePlaceholder')}
            required
          />
        </div>

        <div>
          <span className="block text-sm font-medium text-text mb-1.5">
            {t('stopSequence.form.sequencesLabel')}
          </span>
          <StringListInput
            value={form.sequences}
            onChange={(sequences) => setForm((prev) => ({ ...prev, sequences }))}
          />
        </div>
      </div>
    </ModalShell>
  )
}

export default StopSequenceFormModal
