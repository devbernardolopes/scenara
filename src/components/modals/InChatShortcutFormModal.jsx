import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import Label from '../shared/Label'
import { createInChatShortcut, updateInChatShortcut } from '../../services/inChatShortcuts'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm'

function InChatShortcutFormModal({ inChatShortcut }) {
  const { t } = useTranslation('settings')
  const { closeModal, setCloseGuard } = useModal()
  const { promptSave } = useSaveConfirm()
  const editing = Boolean(inChatShortcut)

  const initial = useMemo(
    () => ({
      name: inChatShortcut?.name || '',
      content: inChatShortcut?.content || '',
      order: inChatShortcut?.order || 'asc',
    }),
    [],
  )

  const [form, setForm] = useState({ ...initial })
  const [saving, setSaving] = useState(false)
  const savePendingRef = useRef(false)

  const isDirty = Object.keys(initial).some((key) => form[key] !== initial[key])

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

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function saveShortcut() {
    setSaving(true)
    try {
      if (editing) {
        await updateInChatShortcut(inChatShortcut.id, {
          name: form.name.trim(),
          content: form.content.trim(),
          order: form.order || 'asc',
        })
      } else {
        await createInChatShortcut({
          name: form.name.trim(),
          content: form.content.trim(),
          order: form.order || 'asc',
        })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.content.trim() || saving) return
    await saveShortcut()
    closeModal()
  }

  async function handleCloseAttempt() {
    const result = await promptSave()
    if (result === 'save') {
      await saveShortcut()
      closeModal()
    } else if (result === 'discard') {
      closeModal()
    }
  }

  return (
    <ModalShell
      title={editing ? t('inChatShortcut.form.editTitle') : t('inChatShortcut.form.title')}
      onClose={isDirty ? handleCloseAttempt : closeModal}
      footer={
        <>
          <button
            type="button"
            onClick={isDirty ? handleCloseAttempt : closeModal}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('inChatShortcut.form.cancel')}
          </button>
          <SaveButton
            isDirty={isDirty}
            saving={saving}
            disabled={!form.name.trim() || !form.content.trim()}
            onClick={handleSave}
            savingText={t('inChatShortcut.form.saving')}
          >
            {t('inChatShortcut.form.save')}
          </SaveButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label required highlight={Boolean(form.name?.trim())}>
            {t('inChatShortcut.form.nameLabel')}
          </Label>
          <input
            className={inputClass}
            value={form.name}
            onChange={update('name')}
            placeholder={t('inChatShortcut.form.namePlaceholder')}
            required
            // autoFocus
          />
        </div>

        <div>
          <Label highlight={Boolean(form.order)}>{t('inChatShortcut.form.order')}</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {['asc', 'desc'].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, order: opt }))}
                className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                  (form.order || 'asc') === opt
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface text-secondary border-border hover:bg-surface-hover'
                }`}
              >
                {t(`inChatShortcut.form.order${opt === 'asc' ? 'Asc' : 'Desc'}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label required highlight={Boolean(form.content?.trim())}>
            {t('inChatShortcut.form.contentLabel')}
          </Label>
          <AutoResizeTextarea
            className={`${inputClass} resize-none mt-1`}
            value={form.content}
            onChange={update('content')}
            placeholder={t('inChatShortcut.form.contentPlaceholder')}
            required
            extraHeight={8}
          />
        </div>
      </div>
    </ModalShell>
  )
}

export default InChatShortcutFormModal
