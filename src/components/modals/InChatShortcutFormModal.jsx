import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import ModalShell from '../shared/ModalShell'
import CollapsibleSection from '../shared/CollapsibleSection'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import { createInChatShortcut, updateInChatShortcut } from '../../services/inChatShortcuts'
import { estimateTokens } from '../../services/tokenEstimator'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

function InChatShortcutFormModal({ inChatShortcut }) {
  const { t } = useTranslation('settings')
  const { closeModal, setCloseGuard } = useModal()
  const { promptSave } = useSaveConfirm()
  const editing = Boolean(inChatShortcut)

  const initialRef = useRef({
    name: inChatShortcut?.name || '',
    content: inChatShortcut?.content || '',
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

  async function saveShortcut() {
    setSaving(true)
    try {
      if (editing) {
        await updateInChatShortcut(inChatShortcut.id, {
          name: form.name.trim(),
          content: form.content.trim(),
        })
      } else {
        await createInChatShortcut({
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
          <button
            type="button"
            onClick={handleSave}
            disabled={!form.name.trim() || saving}
            className="min-h-[44px] px-6 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm disabled:opacity-50"
          >
            {saving ? t('inChatShortcut.form.saving') : t('inChatShortcut.form.save')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            {t('inChatShortcut.form.nameLabel')} <span className="text-error">*</span>
          </label>
          <input
            className={inputClass}
            value={form.name}
            onChange={update('name')}
            placeholder={t('inChatShortcut.form.namePlaceholder')}
            required
            autoFocus
          />
        </div>

        <CollapsibleSection
          label={t('inChatShortcut.form.contentLabel')}
          summary={
            form.content ? t('common:tokenCount', { count: estimateTokens(form.content) }) : null
          }
          storageKey="inChatShortcutContent"
          defaultExpanded={true}
        >
          <AutoResizeTextarea
            className={`${inputClass} resize-none mt-2`}
            value={form.content}
            onChange={update('content')}
            placeholder={t('inChatShortcut.form.contentPlaceholder')}
          />
        </CollapsibleSection>
      </div>
    </ModalShell>
  )
}

export default InChatShortcutFormModal
