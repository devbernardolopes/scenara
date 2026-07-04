import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useConfirm } from '../../lib/confirm'
import { showToast } from '../../lib/toast'
import {
  getAllWritingInstructions,
  deleteWritingInstruction,
  deleteWritingInstructions,
  duplicateWritingInstruction,
  duplicateWritingInstructions,
  exportWritingInstruction,
  exportWritingInstructions,
  importWritingInstructions,
} from '../../services/writingInstructions'
import { downloadJson } from '../../lib/download'
import db from '../../db'
import Avatar from '../shared/Avatar'
import CloseButton from '../shared/CloseButton'
import IconButton from '../shared/IconButton'
import { Plus, Upload, Edit3, Copy, Download, Trash2 } from '../../lib/icons'

function WritingInstructionManagementModal() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const { openModal, closeModal } = useModal()
  const { confirm } = useConfirm()
  const [items, setItems] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const importRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAllWritingInstructions()
      setItems(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    window.addEventListener('writingInstructions-changed', load)
    return () => window.removeEventListener('writingInstructions-changed', load)
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
    openModal('writingInstructionForm')
  }

  function startEdit(item) {
    openModal('writingInstructionForm', { writingInstruction: item })
  }

  async function handleDeleteSingle(item) {
    const linked = (await db.characters.toArray()).filter((c) => c.writingInstruction === item.id)

    const ok = await confirm({
      title: t('writingInstruction.confirmDelete.title'),
      message: t('writingInstruction.confirmDelete.message', { name: item.name }),
      confirmLabel: t('writingInstruction.actions.delete'),
      cancelLabel: tc('cancel'),
      variant: 'danger',
      children:
        linked.length > 0 ? (
          <div className="mb-6">
            <p className="text-sm text-secondary mb-3">
              {t('writingInstruction.confirmDelete.linkedCharacters', { count: linked.length })}
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {linked.map((char) => (
                <div
                  key={char.id}
                  className="flex items-center gap-3 p-2 rounded-md bg-surface-secondary"
                >
                  <Avatar src={char.avatar} size="md" />
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm font-medium text-text truncate">{char.name}</span>
                    <span className="text-xs text-tertiary shrink-0">#{char.characterNumber}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null,
    })
    if (!ok) return
    await deleteWritingInstruction(item.id)
    clearSelection()
  }

  async function handleDeleteSelected() {
    const ok = await confirm({
      title: t('writingInstruction.confirmDelete.title'),
      message: t('writingInstruction.confirmDelete.messageMultiple', { count: selectedIds.size }),
      confirmLabel: t('writingInstruction.actions.delete'),
      cancelLabel: tc('cancel'),
      variant: 'danger',
    })
    if (!ok) return
    await deleteWritingInstructions([...selectedIds])
    clearSelection()
  }

  async function handleDuplicateSingle(item) {
    await duplicateWritingInstruction(item.id)
  }

  async function handleDuplicateSelected() {
    await duplicateWritingInstructions([...selectedIds])
    clearSelection()
  }

  async function handleExportSingle(item) {
    const data = await exportWritingInstruction(item.id)
    const safe = item.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    downloadJson(data, `writing-instruction-${safe}.json`)
  }

  async function handleExportSelected() {
    const data = await exportWritingInstructions([...selectedIds])
    downloadJson({ writingInstructions: data }, 'writing-instructions-export.json')
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
        showToast(t('writingInstruction.import.invalidFormat'), { type: 'error' })
        return
      }
      const items = Array.isArray(data)
        ? data
        : data.writingInstructions
          ? data.writingInstructions
          : [data]
      await importWritingInstructions(items)
    } catch {
      showToast(t('writingInstruction.import.fileError'), { type: 'error' })
    }
  }

  const multi = selectedIds.size > 0

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 border-b border-border shrink-0">
        <h2 className="text-xl font-semibold text-text">{t('writingInstruction.title')}</h2>
        <CloseButton onClick={closeModal} />
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={startCreate}
              className="min-h-[44px] px-4 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> {t('writingInstruction.createWritingInstruction')}
            </button>
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="min-h-[44px] px-4 border border-border rounded-md text-text hover:bg-surface-hover text-sm flex items-center gap-2"
            >
              <Upload className="w-4 h-4" /> {t('writingInstruction.importWritingInstruction')}
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-secondary text-sm">{tc('loading')}</p>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-secondary py-8 text-center">
              {t('writingInstruction.noWritingInstructions')}
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-3 bg-surface transition-shadow cursor-pointer ${
                      selectedIds.has(item.id)
                        ? 'border-primary ring-1 ring-primary'
                        : 'border-border'
                    }`}
                    onClick={() => startEdit(item)}
                  >
                    <div className="flex items-start gap-3">
                      <label
                        className="flex items-center min-h-[44px] min-w-[44px] cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                        />
                      </label>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-text truncate">{item.name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mt-1 -ml-1">
                      <IconButton
                        icon={Edit3}
                        label={t('writingInstruction.actions.edit')}
                        onClick={() => startEdit(item)}
                      />
                      <IconButton
                        icon={Copy}
                        label={t('writingInstruction.actions.duplicate')}
                        onClick={() => handleDuplicateSingle(item)}
                      />
                      <IconButton
                        icon={Download}
                        label={t('writingInstruction.actions.export')}
                        onClick={() => handleExportSingle(item)}
                      />
                      <IconButton
                        icon={Trash2}
                        label={t('writingInstruction.actions.delete')}
                        onClick={() => handleDeleteSingle(item)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {multi && (
                <div className="sticky bottom-0 flex items-center gap-2 p-3 bg-surface border border-border rounded-lg shadow-surface-md">
                  <span className="text-sm text-secondary mr-2">
                    {t('writingInstruction.batch.selected', { count: selectedIds.size })}
                  </span>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="min-h-[44px] px-3 text-sm text-error hover:opacity-80"
                  >
                    {t('writingInstruction.batch.delete', { count: selectedIds.size })}
                  </button>
                  <button
                    type="button"
                    onClick={handleDuplicateSelected}
                    className="min-h-[44px] px-3 text-sm text-text hover:bg-surface-hover rounded-md"
                  >
                    {t('writingInstruction.batch.duplicate', { count: selectedIds.size })}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportSelected}
                    className="min-h-[44px] px-3 text-sm text-text hover:bg-surface-hover rounded-md"
                  >
                    {t('writingInstruction.batch.export', { count: selectedIds.size })}
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="min-h-[44px] px-3 text-sm text-secondary hover:text-text ml-auto"
                  >
                    {t('writingInstruction.batch.clear')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default WritingInstructionManagementModal
