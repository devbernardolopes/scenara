import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { updateThreadTitle } from '../../services/threads'
import CloseButton from '../shared/CloseButton'

function EditThreadTitleModal({ thread }) {
  const { t } = useTranslation('common')
  const { closeModal } = useModal()
  const [title, setTitle] = useState(thread?.title || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
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
    <form onSubmit={handleSubmit} className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text">{t('editThreadTitle.title')}</h2>
        <CloseButton onClick={closeModal} />
      </div>
      <input
        className="w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm mb-6"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('editThreadTitle.placeholder')}
        autoFocus
        required
      />
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={closeModal}
          className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={!title.trim() || saving}
          className="min-h-[44px] px-6 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm disabled:opacity-50"
        >
          {saving ? t('editThreadTitle.saving') : t('editThreadTitle.save')}
        </button>
      </div>
    </form>
  )
}

export default EditThreadTitleModal
