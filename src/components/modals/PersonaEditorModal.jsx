import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useConfirm } from '../../lib/confirm'
import db from '../../db'
import CloseButton from '../shared/CloseButton'
import CollapsibleSection from '../shared/CollapsibleSection'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import { estimateTokens } from '../../services/tokenEstimator'
import Avatar from '../shared/Avatar'
import { Plus, X } from '../../lib/icons'

function formatDataSize(byteLen) {
  if (byteLen < 1024) return `${byteLen} B`
  if (byteLen < 1024 * 1024) return `${(byteLen / 1024).toFixed(1)} KB`
  return `${(byteLen / (1024 * 1024)).toFixed(1)} MB`
}

function PersonaEditorModal() {
  const { t } = useTranslation('characterCreation')
  const { closeModal, openModal } = useModal()
  const { confirm } = useConfirm()
  const [personas, setPersonas] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    name: '',
    avatar: '',
    description: '',
  })

  useEffect(() => {
    db.personas.orderBy('createdAt').toArray().then(setPersonas)
  }, [])

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  function startCreate() {
    setEditing('new')
    setForm({ name: '', avatar: '', description: '' })
  }

  function startEdit(persona) {
    setEditing(persona.id)
    setForm({
      name: persona.name,
      avatar: persona.avatar || '',
      description: persona.description || '',
    })
  }

  function cancelEdit() {
    setEditing(null)
    setForm({ name: '', avatar: '', description: '', context: '' })
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    const now = new Date()
    if (editing === 'new') {
      await db.personas.add({ ...form, createdAt: now, updatedAt: now })
    } else {
      await db.personas.update(editing, { ...form, updatedAt: now })
    }
    const updated = await db.personas.orderBy('createdAt').toArray()
    setPersonas(updated)
    cancelEdit()
  }

  async function handleDelete(id) {
    const ok = await confirm({
      title: t('confirmDeleteTitle'),
      message: t('confirmDelete'),
      confirmLabel: t('deletePersona'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    })
    if (!ok) return
    await db.personas.delete(id)
    const updated = await db.personas.orderBy('createdAt').toArray()
    setPersonas(updated)
    if (editing === id) cancelEdit()
  }

  const inputClass =
    'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex flex-col min-h-0 flex-1">
        <div className="flex items-center justify-between p-6 pb-4 shadow-section shrink-0">
          <h2 className="text-xl font-semibold text-text">
            {editing === 'new' ? t('addPersona') : t('editPersona')}
          </h2>
          <CloseButton onClick={cancelEdit} />
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">
                {t('personaNameLabel')}
              </label>
              <div className="relative">
                <input
                  className={`${inputClass} pr-20`}
                  value={form.name}
                  onChange={update('name')}
                  placeholder={t('personaNamePlaceholder')}
                  required
                  // autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-tertiary">
                  {t('common:tokenCount', { count: estimateTokens(form.name) })}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-1">
                {t('personaAvatarLabel')}
              </label>
              <div className="relative">
                {form.avatar.startsWith('data:') ? (
                  <input
                    className={`${inputClass} pr-10`}
                    value={t('personaAvatarImageData', {
                      size: formatDataSize(form.avatar.length),
                    })}
                    readOnly
                  />
                ) : (
                  <input
                    className={`${inputClass} pr-10`}
                    value={form.avatar}
                    onChange={update('avatar')}
                    placeholder={t('personaAvatarPlaceholder')}
                  />
                )}
                {form.avatar && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, avatar: '' }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
                    aria-label={t('personaAvatarClear')}
                    title={t('personaAvatarClear')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <CollapsibleSection
              label={t('personaDescriptionLabel')}
              summary={
                form.description
                  ? t('common:tokenCount', { count: estimateTokens(form.description) })
                  : null
              }
              storageKey="personaEditorDescription"
              defaultExpanded={true}
            >
              <AutoResizeTextarea
                className={`${inputClass} resize-none mt-2`}
                value={form.description}
                onChange={update('description')}
                placeholder={t('personaDescriptionPlaceholder')}
                extraHeight={8}
              />
            </CollapsibleSection>
          </div>
        </div>

        <div className="flex justify-between px-6 py-4 shadow-section shrink-0">
          <div>
            {editing !== 'new' && (
              <button
                type="button"
                onClick={() => handleDelete(editing)}
                className="min-h-[44px] px-4 text-sm text-error hover:opacity-80"
              >
                {t('deletePersona')}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={cancelEdit}
              className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={!form.name.trim()}
              className="min-h-[44px] px-6 btn-primary text-sm disabled:opacity-50"
            >
              {t('save')}
            </button>
          </div>
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 shadow-section shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-text">{t('personaTitle')}</h2>
          <p className="text-sm text-secondary mt-1">{t('personaSubtitle')}</p>
        </div>
        <CloseButton onClick={closeModal} />
      </div>

      <div className="flex-1 overflow-y-auto p-6 pt-4">
        {personas.length === 0 ? (
          <p className="text-sm text-secondary py-8 text-center">{t('noPersonas')}</p>
        ) : (
          <ul className="space-y-2">
            {personas.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface"
              >
                <Avatar
                  src={p.avatar}
                  size="md"
                  onClick={() =>
                    openModal('imageViewer', { src: p.avatar, modalSize: 'fullscreen' })
                  }
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{p.name}</p>
                  {p.description && (
                    <p className="text-xs text-secondary truncate">{p.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-sm text-secondary hover:text-text"
                >
                  {t('editPersona')}
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={startCreate}
          className="mt-4 w-full min-h-[44px] border-2 border-dashed border-border rounded-lg text-sm text-secondary hover:text-text hover:border-border-light"
        >
          <Plus className="w-4 h-4" /> {t('addPersona')}
        </button>
      </div>
    </div>
  )
}

export default PersonaEditorModal
