import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../../lib/confirm'
import { useToast } from '../../../lib/toast'
import {
  getAllPersonas,
  createPersona,
  updatePersona,
  deletePersona,
  deletePersonas,
  duplicatePersona,
  duplicatePersonas,
  setDefaultPersona,
  exportPersona,
  exportPersonas,
  importPersonas,
} from '../../../services/personas'
import PersonaCard from '../../shared/PersonaCard'
import CollapsibleSection from '../../shared/CollapsibleSection'
import { Plus, Upload, ArrowLeft } from '../../../lib/icons'
import { estimateTokens } from '../../../services/tokenEstimator'

const COLOR_PRESETS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
]

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function PersonaSettingsPanel() {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()
  const { addToast } = useToast()
  const [personas, setPersonas] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [formMode, setFormMode] = useState(null)
  const [form, setForm] = useState({
    name: '',
    title: '',
    avatar: '',
    description: '',
    color: '',
    context: '',
    isDefault: false,
  })
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = await getAllPersonas()
      setPersonas(p)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    window.addEventListener('personas-changed', load)
    return () => window.removeEventListener('personas-changed', load)
  }, [load])

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function startCreate() {
    setForm({
      name: '',
      title: '',
      avatar: '',
      description: '',
      color: '',
      context: '',
      isDefault: false,
    })
    setEditingId(null)
    setFormMode('create')
  }

  function startEdit(p) {
    setForm({
      name: p.name || '',
      title: p.title || '',
      avatar: p.avatar || '',
      description: p.description || '',
      color: p.color || '',
      context: p.context || '',
      isDefault: Boolean(p.isDefault),
    })
    setEditingId(p.id)
    setFormMode('edit')
  }

  function cancelForm() {
    setFormMode(null)
    setEditingId(null)
    setForm({
      name: '',
      title: '',
      avatar: '',
      description: '',
      color: '',
      context: '',
      isDefault: false,
    })
  }

  function cancelForm() {
    setFormMode(null)
    setForm({
      name: '',
      title: '',
      avatar: '',
      description: '',
      color: '',
      context: '',
      isDefault: false,
    })
  }

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

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

  async function handleSaveForm(e) {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      if (formMode === 'edit' && editingId) {
        await updatePersona(editingId, {
          name: form.name.trim(),
          title: form.title.trim(),
          avatar: form.avatar,
          description: form.description.trim(),
          color: form.color,
          context: form.context.trim(),
          isDefault: form.isDefault,
        })
      } else {
        await createPersona({
          name: form.name.trim(),
          title: form.title.trim(),
          avatar: form.avatar,
          description: form.description.trim(),
          color: form.color,
          context: form.context.trim(),
          isDefault: form.isDefault,
        })
      }
      cancelForm()
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteSingle(p) {
    const ok = await confirm({
      title: t('persona.confirmDelete.title'),
      message: t('persona.confirmDelete.message', { name: p.name }),
      confirmLabel: t('persona.actions.delete'),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (!ok) return
    await deletePersona(p.id)
    clearSelection()
  }

  async function handleDeleteSelected() {
    const ok = await confirm({
      title: t('persona.confirmDelete.title'),
      message: t('persona.confirmDelete.messageMultiple', { count: selectedIds.size }),
      confirmLabel: t('persona.actions.delete'),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (!ok) return
    await deletePersonas([...selectedIds])
    clearSelection()
  }

  async function handleSetDefault(p) {
    await setDefaultPersona(p.id)
  }

  async function handleDuplicateSingle(p) {
    await duplicatePersona(p.id)
  }

  async function handleDuplicateSelected() {
    await duplicatePersonas([...selectedIds])
    clearSelection()
  }

  async function handleExportSingle(p) {
    const data = await exportPersona(p.id)
    const safe = p.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    downloadJson(data, `persona-${safe}.json`)
  }

  async function handleExportSelected() {
    const data = await exportPersonas([...selectedIds])
    downloadJson({ personas: data }, 'personas-export.json')
    clearSelection()
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const text = await file.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        addToast(t('persona.import.invalidFormat'), { type: 'error' })
        return
      }
      const items = Array.isArray(data) ? data : data.personas ? data.personas : [data]
      const added = await importPersonas(items)
      addToast(t('persona.import.importSuccess', { count: added.length }), { type: 'success' })
    } catch {
      addToast(t('persona.import.fileError'), { type: 'error' })
    }
  }

  const multi = selectedIds.size > 0

  if (formMode) {
    return (
      <div>
        <button
          type="button"
          onClick={cancelForm}
          className="min-h-[44px] flex items-center gap-1 text-sm text-secondary hover:text-text mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> {t('persona.form.back')}
        </button>
        <form onSubmit={handleSaveForm} className="space-y-4">
          <h3 className="text-lg font-semibold text-text">
            {formMode === 'edit' ? t('persona.form.editTitle') : t('persona.form.title')}
          </h3>

          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t('persona.form.inChatName')} <span className="text-error">*</span>
            </label>
            <input
              className={inputClass}
              value={form.name}
              onChange={update('name')}
              placeholder={t('persona.form.inChatNamePlaceholder')}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t('persona.form.displayName')}
            </label>
            <input
              className={inputClass}
              value={form.title}
              onChange={update('title')}
              placeholder={t('persona.form.displayNamePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t('persona.form.avatarLabel')}
            </label>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={form.avatar}
                onChange={update('avatar')}
                placeholder={t('persona.form.avatarPlaceholder')}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center border border-border rounded-md text-secondary hover:text-text hover:bg-surface-hover shrink-0"
                aria-label={t('persona.form.uploadFile')}
                title={t('persona.form.uploadFile')}
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
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t('persona.form.descriptionLabel')}
            </label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={form.description}
              onChange={update('description')}
              placeholder={t('persona.form.descriptionPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              {t('persona.form.colorLabel')}
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, color: prev.color === c ? '' : c }))}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-text scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
              <input
                type="text"
                value={form.color}
                onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                placeholder="#"
                className="w-20 px-2 py-1 border border-border rounded-md bg-surface text-text text-xs"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-text">{t('persona.form.setDefault')}</span>
          </label>

          <CollapsibleSection
            label={t('persona.form.contextLabel')}
            summary={form.context ? `${estimateTokens(form.context)} tokens` : null}
            storageKey="personaFormContext"
          >
            <textarea
              className={`${inputClass} resize-none mt-2`}
              rows={5}
              value={form.context}
              onChange={update('context')}
              placeholder={t('persona.form.contextPlaceholder')}
            />
          </CollapsibleSection>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={cancelForm}
              className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
            >
              {t('persona.form.cancel')}
            </button>
            <button
              type="submit"
              disabled={!form.name.trim() || saving}
              className="min-h-[44px] px-6 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm disabled:opacity-50"
            >
              {saving ? t('persona.form.saving') : t('persona.form.save')}
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-secondary text-sm">{t('common:loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={startCreate}
          className="min-h-[44px] px-4 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> {t('persona.createPersona')}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="min-h-[44px] px-4 border border-border rounded-md text-text hover:bg-surface-hover text-sm flex items-center gap-2"
        >
          <Upload className="w-4 h-4" /> {t('persona.importPersona')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
        />
      </div>

      {personas.length === 0 ? (
        <p className="text-sm text-secondary py-8 text-center">{t('persona.noPersonas')}</p>
      ) : (
        <>
          <div className="space-y-3">
            {personas.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                selected={selectedIds.has(p.id)}
                onToggleSelect={toggleSelect}
                onEdit={startEdit}
                onDelete={handleDeleteSingle}
                onSetDefault={handleSetDefault}
                onDuplicate={handleDuplicateSingle}
                onExport={handleExportSingle}
              />
            ))}
          </div>

          {multi && (
            <div className="sticky bottom-0 flex items-center gap-2 p-3 bg-surface border border-border rounded-lg shadow-surface-md">
              <span className="text-sm text-secondary mr-2">
                {t('persona.batch.selected', { count: selectedIds.size })}
              </span>
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="min-h-[44px] px-3 text-sm text-error hover:opacity-80"
              >
                {t('persona.batch.delete', { count: selectedIds.size })}
              </button>
              <button
                type="button"
                onClick={handleDuplicateSelected}
                className="min-h-[44px] px-3 text-sm text-text hover:bg-surface-hover rounded-md"
              >
                {t('persona.batch.duplicate', { count: selectedIds.size })}
              </button>
              <button
                type="button"
                onClick={handleExportSelected}
                className="min-h-[44px] px-3 text-sm text-text hover:bg-surface-hover rounded-md"
              >
                {t('persona.batch.export', { count: selectedIds.size })}
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="min-h-[44px] px-3 text-sm text-secondary hover:text-text ml-auto"
              >
                {t('persona.batch.clear')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default PersonaSettingsPanel
