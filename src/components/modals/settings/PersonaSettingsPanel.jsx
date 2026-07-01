import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../../hooks/useModal'
import { useConfirm } from '../../../lib/confirm'
import { useToast } from '../../../lib/toast'
import {
  getAllPersonas,
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
import { Plus, Upload } from '../../../lib/icons'

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
  const { openModal } = useModal()
  const { confirm } = useConfirm()
  const { addToast } = useToast()
  const [personas, setPersonas] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const importRef = useRef(null)

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
    openModal('personaForm')
  }

  function startEdit(p) {
    openModal('personaForm', { persona: p })
  }

  async function handleDeleteSingle(p) {
    if (personas.length <= 1) return
    const ok = await confirm({
      title: t('persona.confirmDelete.title'),
      message: t('persona.confirmDelete.message', { name: p.name }),
      confirmLabel: t('persona.actions.delete'),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deletePersona(p.id)
    } catch {
      return
    }
    clearSelection()
  }

  async function handleDeleteSelected() {
    if (selectedIds.size >= personas.length) return
    const ok = await confirm({
      title: t('persona.confirmDelete.title'),
      message: t('persona.confirmDelete.messageMultiple', { count: selectedIds.size }),
      confirmLabel: t('persona.actions.delete'),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deletePersonas([...selectedIds])
    } catch {
      return
    }
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
          onClick={() => importRef.current?.click()}
          className="min-h-[44px] px-4 border border-border rounded-md text-text hover:bg-surface-hover text-sm flex items-center gap-2"
        >
          <Upload className="w-4 h-4" /> {t('persona.importPersona')}
        </button>
        <input
          ref={importRef}
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
                isOnlyOne={personas.length <= 1}
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
