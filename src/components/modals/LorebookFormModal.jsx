import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'
import CollapsibleSection from '../shared/CollapsibleSection'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import Label from '../shared/Label'
import Avatar from '../shared/Avatar'
import { Plus, X, ChevronUp, ChevronDown, Pencil } from '../../lib/icons'
import { estimateTokens } from '../../services/tokenEstimator'
import { createLorebook, updateLorebook } from '../../services/lorebooks'
import {
  getEntriesForLorebook,
  deleteEntry,
  updateEntryOrder,
} from '../../services/lorebookEntries'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

function formatDataSize(byteLen) {
  if (byteLen < 1024) return `${byteLen} B`
  if (byteLen < 1024 * 1024) return `${(byteLen / 1024).toFixed(1)} KB`
  return `${(byteLen / (1024 * 1024)).toFixed(1)} MB`
}

function ToggleRow({ label, checked, onChange, disabled = false }) {
  return (
    <label
      className={`flex items-center justify-between gap-3 min-h-[44px] ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <span className="text-sm text-text">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
          checked ? 'bg-primary' : 'bg-gray-300'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}

function LorebookFormModal({ lorebook }) {
  const { t } = useTranslation('settings')
  const { closeModal, setCloseGuard, openModal } = useModal()
  const { promptSave } = useSaveConfirm()
  const editing = Boolean(lorebook)
  const lorebookId = lorebook?.id || null

  const initial = useMemo(
    () => ({
      name: lorebook?.name || '',
      avatar: lorebook?.avatar || '',
      description: lorebook?.description || '',
      scanDepth: lorebook?.scanDepth ?? null,
      tokenBudget: lorebook?.tokenBudget ?? null,
      recursiveScanning: Boolean(lorebook?.recursiveScanning),
      isGlobal: Boolean(lorebook?.isGlobal),
    }),
    [],
  )

  const [form, setForm] = useState({ ...initial })
  const [entries, setEntries] = useState([])
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const savePendingRef = useRef(false)

  const isDirty = Object.keys(initial).some((key) => form[key] !== initial[key])

  useEffect(() => {
    if (lorebookId) {
      getEntriesForLorebook(lorebookId).then(setEntries)
    }
  }, [lorebookId])

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

  async function handleFileUpload(e) {
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

  async function saveLorebook() {
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        avatar: form.avatar,
        description: form.description.trim(),
        scanDepth: form.scanDepth === '' || form.scanDepth == null ? null : Number(form.scanDepth),
        tokenBudget:
          form.tokenBudget === '' || form.tokenBudget == null ? null : Number(form.tokenBudget),
        recursiveScanning: form.recursiveScanning,
        isGlobal: form.isGlobal,
      }
      if (editing) {
        await updateLorebook(lorebook.id, payload)
      } else {
        await createLorebook(payload)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim() || saving) return
    await saveLorebook()
    closeModal()
  }

  async function handleCloseAttempt() {
    const result = await promptSave()
    if (result === 'save') {
      await saveLorebook()
      closeModal()
    } else if (result === 'discard') {
      closeModal()
    }
  }

  function openEntry(entry) {
    openModal('lorebookEntryForm', { lorebookId, entry })
  }

  function addEntry() {
    openModal('lorebookEntryForm', { lorebookId, entry: null })
  }

  async function handleDeleteEntry(entry) {
    if (entry.id != null) {
      await deleteEntry(entry.id)
    }
    setEntries((prev) => prev.filter((e) => e !== entry))
  }

  async function handleMoveEntry(index, dir) {
    const next = entries.map((e) => ({ ...e }))
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setEntries(next)
    await updateEntryOrder(
      lorebookId,
      next.map((e) => e.id),
    )
  }

  const addEntryRef = useRef(addEntry)
  const openEntryRef = useRef(openEntry)
  useEffect(() => {
    addEntryRef.current = addEntry
    openEntryRef.current = openEntry
  })
  useEffect(() => {
    async function loadEntries() {
      if (lorebookId) setEntries(await getEntriesForLorebook(lorebookId))
    }
    window.addEventListener('lorebook-entries-changed', loadEntries)
    return () => window.removeEventListener('lorebook-entries-changed', loadEntries)
  }, [lorebookId])

  return (
    <ModalShell
      title={editing ? t('lorebook.form.editTitle') : t('lorebook.form.title')}
      onClose={isDirty ? handleCloseAttempt : closeModal}
      footer={
        <>
          <button
            type="button"
            onClick={isDirty ? handleCloseAttempt : closeModal}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('lorebook.form.cancel')}
          </button>
          <SaveButton
            isDirty={isDirty}
            saving={saving}
            disabled={!form.name.trim()}
            onClick={handleSave}
            savingText={t('lorebook.form.saving')}
          >
            {t('lorebook.form.save')}
          </SaveButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label required highlight={Boolean(form.name.trim())}>
            {t('lorebook.form.name')}
          </Label>
          <input
            className={inputClass}
            value={form.name}
            onChange={update('name')}
            placeholder={t('lorebook.form.namePlaceholder')}
            required
          />
        </div>

        <div>
          <Label>{t('lorebook.form.avatar')}</Label>
          <div className="flex items-center gap-2">
            <Avatar
              src={form.avatar}
              size="2xl"
              className="shrink-0 cursor-pointer"
              onClick={() =>
                form.avatar &&
                openModal('imageViewer', { src: form.avatar, modalSize: 'fullscreen' })
              }
            />
            <div className="relative flex-1">
              {form.avatar.startsWith('data:') ? (
                <input
                  className={`${inputClass} pr-10`}
                  value={t('lorebook.form.avatarImageData', {
                    size: formatDataSize(form.avatar.length),
                  })}
                  readOnly
                />
              ) : (
                <input
                  className={`${inputClass} pr-10`}
                  value={form.avatar}
                  onChange={update('avatar')}
                  placeholder={t('lorebook.form.avatarPlaceholder')}
                />
              )}
              {form.avatar && (
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, avatar: '' }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
                  aria-label={t('lorebook.form.avatarClear')}
                  title={t('lorebook.form.avatarClear')}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center border border-border rounded-md text-secondary hover:text-text hover:bg-surface-hover shrink-0"
              aria-label={t('lorebook.form.uploadFile')}
              title={t('lorebook.form.uploadFile')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v2a2 2 0 002 2h12a2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12"
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

        <CollapsibleSection
          label={t('lorebook.form.description')}
          summary={
            form.description
              ? t('common:tokenCount', { count: estimateTokens(form.description) })
              : null
          }
          storageKey="lorebookFormDescription"
          defaultExpanded={true}
        >
          <AutoResizeTextarea
            className={`${inputClass} resize-none mt-2`}
            value={form.description}
            onChange={update('description')}
            placeholder={t('lorebook.form.descriptionPlaceholder')}
            extraHeight={8}
          />
        </CollapsibleSection>

        <CollapsibleSection
          label={t('lorebook.form.globalSettings')}
          storageKey="lorebookFormGlobalSettings"
          defaultExpanded={false}
        >
          <div className="pt-2 space-y-4">
            <div>
              <Label>{t('lorebook.form.scanDepth')}</Label>
              <input
                type="number"
                className={inputClass}
                value={form.scanDepth ?? ''}
                onChange={update('scanDepth')}
                placeholder="50"
              />
            </div>
            <div>
              <Label>{t('lorebook.form.tokenBudget')}</Label>
              <input
                type="number"
                className={inputClass}
                value={form.tokenBudget ?? ''}
                onChange={update('tokenBudget')}
                placeholder="500"
              />
            </div>
            <ToggleRow
              label={t('lorebook.form.recursiveScanning')}
              checked={form.recursiveScanning}
              onChange={(v) => setForm((prev) => ({ ...prev, recursiveScanning: v }))}
            />
            <ToggleRow
              label={t('lorebook.form.isGlobal')}
              checked={form.isGlobal}
              onChange={(v) => setForm((prev) => ({ ...prev, isGlobal: v }))}
            />
          </div>
        </CollapsibleSection>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>{t('lorebook.form.entries')}</Label>
            <span className="text-xs text-tertiary">{entries.length}</span>
          </div>

          {entries.length === 0 ? (
            <p className="text-sm text-tertiary text-center py-4">{t('lorebook.form.noEntries')}</p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, idx) => (
                <div
                  key={entry.id ?? `${entry.name}-${idx}`}
                  className="flex items-center gap-2 border border-border rounded-md p-2 bg-surface"
                >
                  <button
                    type="button"
                    onClick={() => openEntryRef.current(entry)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="font-medium text-text text-sm truncate">
                      {entry.name || entry.keys?.[0] || t('lorebook.form.untitledEntry')}
                    </div>
                    {entry.keys?.length > 0 && (
                      <div className="text-xs text-secondary truncate">{entry.keys.join(', ')}</div>
                    )}
                  </button>
                  {!entry.enabled && (
                    <span className="shrink-0 text-[10px] uppercase px-1.5 py-0.5 rounded bg-warning text-on-warning">
                      {t('lorebook.form.disabled')}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => openEntryRef.current(entry)}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-secondary hover:text-text rounded-md hover:bg-surface-hover"
                    aria-label={t('lorebook.form.editEntry')}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleMoveEntry(idx, -1)}
                      disabled={idx === 0}
                      className="min-h-[36px] min-w-[32px] flex items-center justify-center text-secondary hover:text-text rounded-md hover:bg-surface-hover disabled:opacity-30"
                      aria-label={t('lorebook.form.moveUp')}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveEntry(idx, 1)}
                      disabled={idx === entries.length - 1}
                      className="min-h-[36px] min-w-[32px] flex items-center justify-center text-secondary hover:text-text rounded-md hover:bg-surface-hover disabled:opacity-30"
                      aria-label={t('lorebook.form.moveDown')}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteEntry(entry)}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-on-delete bg-delete hover:bg-delete-hover rounded-md"
                    aria-label={t('lorebook.form.deleteEntry')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => addEntryRef.current()}
            className="w-full mt-2 min-h-[44px] flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-md text-secondary hover:text-text hover:border-border-light transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">{t('lorebook.form.addEntry')}</span>
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

export default LorebookFormModal
