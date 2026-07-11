import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'
import CollapsibleSection from '../shared/CollapsibleSection'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import Label from '../shared/Label'
import {
  createWritingInstruction,
  updateWritingInstruction,
} from '../../services/writingInstructions'
import { estimateTokens } from '../../services/tokenEstimator'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

function WritingInstructionFormModal({ writingInstruction }) {
  const { t } = useTranslation('settings')
  const { closeModal, setCloseGuard } = useModal()
  const { promptSave } = useSaveConfirm()
  const editing = Boolean(writingInstruction)

  const initialRef = useRef({
    name: writingInstruction?.name || '',
    content: writingInstruction?.content || '',
  })

  const [form, setForm] = useState({ ...initialRef.current })
  const [saving, setSaving] = useState(false)
  const savePendingRef = useRef(false)

  const isDirty = Object.keys(initialRef.current).some(
    (key) => form[key] !== initialRef.current[key],
  )

  const handleCloseRef = useRef()
  handleCloseRef.current = handleCloseAttempt

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

  async function saveInstruction() {
    setSaving(true)
    try {
      if (editing) {
        await updateWritingInstruction(writingInstruction.id, {
          name: form.name.trim(),
          content: form.content.trim(),
        })
      } else {
        await createWritingInstruction({
          name: form.name.trim(),
          content: form.content.trim(),
        })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim() || saving) return
    await saveInstruction()
    closeModal()
  }

  async function handleCloseAttempt() {
    const result = await promptSave()
    if (result === 'save') {
      await saveInstruction()
      closeModal()
    } else if (result === 'discard') {
      closeModal()
    }
  }

  return (
    <ModalShell
      title={editing ? t('writingInstruction.form.editTitle') : t('writingInstruction.form.title')}
      onClose={isDirty ? handleCloseAttempt : closeModal}
      footer={
        <>
          <button
            type="button"
            onClick={isDirty ? handleCloseAttempt : closeModal}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('writingInstruction.form.cancel')}
          </button>
          <SaveButton
            isDirty={isDirty}
            saving={saving}
            disabled={!form.name.trim()}
            onClick={handleSave}
            savingText={t('writingInstruction.form.saving')}
          >
            {t('writingInstruction.form.save')}
          </SaveButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label required>{t('writingInstruction.form.nameLabel')}</Label>
          <input
            className={inputClass}
            value={form.name}
            onChange={update('name')}
            placeholder={t('writingInstruction.form.namePlaceholder')}
            required
            autoFocus
          />
        </div>

        <CollapsibleSection
          label={t('writingInstruction.form.contentLabel')}
          summary={
            form.content ? t('common:tokenCount', { count: estimateTokens(form.content) }) : null
          }
          storageKey="writingInstructionContent"
          defaultExpanded={true}
        >
          <AutoResizeTextarea
            className={`${inputClass} resize-none mt-2`}
            value={form.content}
            onChange={update('content')}
            placeholder={t('writingInstruction.form.contentPlaceholder')}
          />
        </CollapsibleSection>
      </div>
    </ModalShell>
  )
}

export default WritingInstructionFormModal
