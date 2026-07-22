import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'
import Label from '../shared/Label'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm'

function CreatePromptBankKindModal({ onCreated }) {
  const { t } = useTranslation('settings')
  const { closeModal } = useModal()
  const { promptSave } = useSaveConfirm()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  function closeWithGuard() {
    if (name.trim()) {
      promptSave().then((result) => {
        if (result === 'discard') closeModal()
      })
    } else {
      closeModal()
    }
  }

  function handleSave() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      if (typeof onCreated === 'function') onCreated(name.trim())
    } finally {
      setSaving(false)
    }
    closeModal()
  }

  return (
    <ModalShell
      title={t('promptBank.form.createKindTitle')}
      onClose={closeWithGuard}
      footer={
        <>
          <button
            type="button"
            onClick={closeWithGuard}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('promptBank.form.cancel')}
          </button>
          <SaveButton
            isDirty={Boolean(name.trim())}
            saving={saving}
            disabled={!name.trim()}
            onClick={handleSave}
            savingText={t('promptBank.form.saving')}
          >
            {t('promptBank.form.createKindSave')}
          </SaveButton>
        </>
      }
    >
      <div>
        <Label required highlight={Boolean(name.trim())}>
          {t('promptBank.form.kindLabel')}
        </Label>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('promptBank.form.kindPlaceholder')}
          required
          autoFocus
        />
      </div>
    </ModalShell>
  )
}

export default CreatePromptBankKindModal
