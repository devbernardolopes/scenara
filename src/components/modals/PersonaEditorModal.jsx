import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import db from '../../db'
import { createCharacter as createPersona } from '../../services/characters'
import CollapsibleSection from '../shared/CollapsibleSection'
import CloseButton from '../shared/CloseButton'
import { Plus } from '../../lib/icons'

function PersonaEditorModal() {
  const { t } = useTranslation('characterCreation')
  const { closeModal } = useModal()
  const [personas, setPersonas] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    name: '',
    avatar: '',
    description: '',
    context: '',
  })

  useEffect(() => {
    db.personas.orderBy('createdAt').toArray().then(setPersonas)
  }, [])

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  function startCreate() {
    setEditing('new')
    setForm({ name: '', avatar: '', description: '', context: '' })
  }

  function startEdit(persona) {
    setEditing(persona.id)
    setForm({
      name: persona.name,
      avatar: persona.avatar || '',
      description: persona.description || '',
      context: persona.context || '',
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
    await db.personas.delete(id)
    const updated = await db.personas.orderBy('createdAt').toArray()
    setPersonas(updated)
    if (editing === id) cancelEdit()
  }

  const inputClass =
    'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

  if (editing) {
    return (
      <form onSubmit={handleSave} className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text">
            {editing === 'new' ? t('addPersona') : t('editPersona')}
          </h2>
        <CloseButton onClick={cancelEdit} />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">{t('personaNameLabel')}</label>
            <input
              className={inputClass}
              value={form.name}
              onChange={update('name')}
              placeholder={t('personaNamePlaceholder')}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">{t('personaAvatarLabel')}</label>
            <input
              className={inputClass}
              value={form.avatar}
              onChange={update('avatar')}
              placeholder={t('personaAvatarPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t('personaDescriptionLabel')}
            </label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={form.description}
              onChange={update('description')}
              placeholder={t('personaDescriptionPlaceholder')}
            />
          </div>

          <CollapsibleSection label={t('personaContextLabel')} storageKey="personaContext">
            <textarea
              className={`${inputClass} resize-none mt-2`}
              rows={5}
              value={form.context}
              onChange={update('context')}
              placeholder={t('personaContextPlaceholder')}
            />
          </CollapsibleSection>
        </div>

        <div className="flex justify-between mt-6 pt-4 border-t border-border">
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
              className="min-h-[44px] px-6 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm disabled:opacity-50"
            >
              {t('save')}
            </button>
          </div>
        </div>
      </form>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-text">{t('personaTitle')}</h2>
          <p className="text-sm text-secondary mt-1">{t('personaSubtitle')}</p>
        </div>
        <CloseButton onClick={closeModal} />
      </div>

      {personas.length === 0 ? (
        <p className="text-sm text-secondary py-8 text-center">{t('noPersonas')}</p>
      ) : (
        <ul className="space-y-2">
          {personas.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface"
            >
              <span className="text-2xl">{p.avatar || '👤'}</span>
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
  )
}

export default PersonaEditorModal
