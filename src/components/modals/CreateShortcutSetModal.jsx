import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'
import Label from '../shared/Label'
import { createInChatShortcut } from '../../services/inChatShortcuts'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

function CreateShortcutSetModal({ onCreated }) {
  const { t } = useTranslation('chat')
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

  async function handleSave() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const id = await createInChatShortcut({ name: name.trim(), content: '', order: 'asc' })
      if (typeof onCreated === 'function') onCreated(id)
    } finally {
      setSaving(false)
    }
    closeModal()
  }

  return (
    <ModalShell
      title={t('createShortcutSet.title')}
      onClose={closeWithGuard}
      footer={
        <>
          <button
            type="button"
            onClick={closeWithGuard}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('createShortcutSet.cancel')}
          </button>
          <SaveButton
            isDirty={Boolean(name.trim())}
            saving={saving}
            disabled={!name.trim()}
            onClick={handleSave}
            savingText={t('createShortcutSet.saving')}
          >
            {t('createShortcutSet.save')}
          </SaveButton>
        </>
      }
    >
      <div>
        <Label required highlight={Boolean(name.trim())}>
          {t('createShortcutSet.nameLabel')}
        </Label>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('createShortcutSet.namePlaceholder')}
          required
          autoFocus
        />
      </div>
    </ModalShell>
  )
}

export default CreateShortcutSetModal
