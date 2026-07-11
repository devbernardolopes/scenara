import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { updateThreadTitle } from '../../services/threads'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'

function EditThreadTitleModal({ thread }) {
  const { t } = useTranslation('common')
  const { closeModal } = useModal()
  const initialTitle = thread?.title || ''
  const [title, setTitle] = useState(initialTitle)
  const [saving, setSaving] = useState(false)
  const isDirty = title !== initialTitle

  async function handleSave() {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await updateThreadTitle(thread.id, title.trim())
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell
      title={t('editThreadTitle.title')}
      onClose={closeModal}
      footer={
        <>
          <button
            type="button"
            onClick={closeModal}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('cancel')}
          </button>
          <SaveButton
            isDirty={isDirty}
            saving={saving}
            disabled={!title.trim()}
            onClick={handleSave}
            savingText={t('editThreadTitle.saving')}
          >
            {t('editThreadTitle.save')}
          </SaveButton>
        </>
      }
    >
      <input
        className="w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleSave()
          }
        }}
        placeholder={t('editThreadTitle.placeholder')}
        autoFocus
        required
      />
    </ModalShell>
  )
}

export default EditThreadTitleModal
