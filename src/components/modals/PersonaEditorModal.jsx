import { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useConfirm } from '../../lib/confirm'
import { showToast } from '../../lib/toast'
import db from '../../db'
import CloseButton from '../shared/CloseButton'
import CollapsibleSection from '../shared/CollapsibleSection'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import { estimateTokens } from '../../services/tokenEstimator'
import Avatar from '../shared/Avatar'
import { Plus, X, Cloud } from '../../lib/icons'
import { useModalScrollPosition } from '../../hooks/useModalScrollPosition'
import { getCatboxService, catboxUploadAvatar } from '../../services/cloudServices'
import { validateUploadSize } from '../../services/catbox'

function formatDataSize(byteLen) {
  if (byteLen < 1024) return `${byteLen} B`
  if (byteLen < 1024 * 1024) return `${(byteLen / 1024).toFixed(1)} KB`
  return `${(byteLen / (1024 * 1024)).toFixed(1)} MB`
}

function PersonaEditorModal() {
  const { t } = useTranslation('characterCreation')
  const { closeModal, openModal } = useModal()
  const { confirm } = useConfirm()
  const { scrollRef, onScroll } = useModalScrollPosition('personaEditor')
  const [personas, setPersonas] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    name: '',
    avatar: '',
    description: '',
  })
  const fileRef = useRef(null)
  const [catboxService, setCatboxService] = useState(null)
  const [converting, setConverting] = useState(false)
  const catboxAbortRef = useRef(null)

  useEffect(() => {
    return () => {
      catboxAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    db.personas.orderBy('createdAt').toArray().then(setPersonas)
  }, [])

  useEffect(() => {
    getCatboxService().then(setCatboxService)
    const handler = () => getCatboxService().then(setCatboxService)
    window.addEventListener('cloudServices-changed', handler)
    return () => window.removeEventListener('cloudServices-changed', handler)
  }, [])

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result
      if (typeof dataUrl === 'string') {
        setForm((prev) => ({ ...prev, avatar: dataUrl }))
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleConvertToCatbox() {
    if (!catboxService) {
      showToast(t('catboxNoService'), { type: 'warning' })
      return
    }
    const validation = validateUploadSize(form.avatar)
    if (!validation.ok) {
      const isGif = form.avatar.includes('image/gif')
      showToast(
        t('catboxSizeLimit', { limit: validation.limitMB, type: isGif ? 'GIF' : 'image' }),
        { type: 'error' },
      )
      return
    }
    catboxAbortRef.current?.abort()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)
    catboxAbortRef.current = controller
    setConverting(true)
    try {
      const url = await catboxUploadAvatar(catboxService, form.avatar, {
        signal: controller.signal,
      })
      setForm((prev) => ({ ...prev, avatar: url }))
      showToast(t('catboxConvertSuccess'), { type: 'success' })
    } catch (err) {
      if (err.name === 'AbortError') {
        showToast(t('catboxConvertError', { error: 'Timed out' }), { type: 'error' })
      } else {
        showToast(t('catboxConvertError', { error: err.message }), { type: 'error' })
      }
    } finally {
      clearTimeout(timeoutId)
      catboxAbortRef.current = null
      setConverting(false)
    }
  }

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
              <label
                className={`block text-sm font-medium mb-1 ${form.avatar?.trim() ? 'text-highlight' : 'text-text'}`}
              >
                {t('personaAvatarLabel')}
              </label>
              <div className="flex items-center gap-2">
                <Avatar
                  src={form.avatar}
                  size="2xl"
                  className="shrink-0"
                  onClick={() =>
                    form.avatar &&
                    openModal('imageViewer', { src: form.avatar, modalSize: 'fullscreen' })
                  }
                />
                <div className="relative flex-1">
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
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center border border-border rounded-md text-secondary hover:text-text hover:bg-surface-hover shrink-0"
                  aria-label={t('uploadImage', { ns: 'common' })}
                  title={t('uploadImage', { ns: 'common' })}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12"
                    />
                  </svg>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              {form.avatar.startsWith('data:') && catboxService && (
                <button
                  type="button"
                  onClick={handleConvertToCatbox}
                  disabled={converting}
                  className="flex items-center gap-1.5 mt-1.5 text-xs text-accent hover:underline disabled:opacity-50"
                >
                  <Cloud className="w-3 h-3" />
                  {converting ? t('convertingToCatbox') : t('convertToCatbox')}
                </button>
              )}
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

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-6 pt-4">
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
