import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useModalScrollPosition } from '../../hooks/useModalScrollPosition'
import { useSaveConfirm } from '../../lib/saveConfirm'
import { useConfirm } from '../../lib/confirm'
import { isValidAvatar, normalizeAvatar } from '../../lib/image'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'
import CollapsibleSection from '../shared/CollapsibleSection'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import Label from '../shared/Label'
import AvatarInput from '../shared/AvatarInput'
import { Plus, X, Zap, Square, Cloud } from '../../lib/icons'
import DragHandle from '../shared/DragHandle'
import { SortableList, SortableItem } from '../shared/SortableList'
import { estimateTokens } from '../../services/tokenEstimator'
import { createLorebook, updateLorebook } from '../../services/lorebooks'
import {
  getEntriesForLorebook,
  deleteEntry,
  updateEntry,
  updateEntryOrder,
} from '../../services/lorebookEntries'
import { showToast } from '../../lib/toast'
import {
  getCatboxService,
  catboxUploadAvatar,
  getImgchestService,
  imgchestUploadAvatar,
} from '../../services/cloudServices'
import { validateUploadSize } from '../../services/catbox'
import { validateImgchestUploadSize } from '../../services/imgchest'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm'

function formatDataSize(byteLen) {
  if (byteLen < 1024) return `${byteLen} B`
  if (byteLen < 1024 * 1024) return `${(byteLen / 1024).toFixed(1)} KB`
  return `${(byteLen / (1024 * 1024)).toFixed(1)} MB`
}

function ToggleRow({ label, checked, onChange, disabled = false, description }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 min-h-[44px] ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm text-text">{label}</span>
        {description && <span className="block text-xs text-secondary mt-0.5">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
          checked ? 'toggle-track-on' : 'toggle-track-off'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full toggle-knob transform transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

function LorebookFormModal({ lorebook }) {
  const { t } = useTranslation('settings')
  const { closeModal, setCloseGuard, openModal } = useModal()
  const { promptSave } = useSaveConfirm()
  const { confirm } = useConfirm()
  const [editing, setEditing] = useState(Boolean(lorebook))
  const [lorebookId, setLorebookId] = useState(lorebook?.id || null)
  const { scrollRef, onScroll } = useModalScrollPosition(`lorebookForm.${lorebookId ?? 'new'}`)

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
  const savePendingRef = useRef(false)
  const [catboxService, setCatboxService] = useState(null)
  const [converting, setConverting] = useState(false)
  const catboxAbortRef = useRef(null)
  const [imgchestService, setImgchestService] = useState(null)
  const [convertingImgchest, setConvertingImgchest] = useState(false)
  const imgchestAbortRef = useRef(null)
  const catboxCancelledRef = useRef(false)
  const imgchestCancelledRef = useRef(false)

  useEffect(() => {
    return () => {
      catboxCancelledRef.current = true
      catboxAbortRef.current?.abort()
      imgchestCancelledRef.current = true
      imgchestAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    getCatboxService().then(setCatboxService)
    getImgchestService().then(setImgchestService)
    const handler = () => {
      getCatboxService().then(setCatboxService)
      getImgchestService().then(setImgchestService)
    }
    window.addEventListener('cloudServices-changed', handler)
    return () => window.removeEventListener('cloudServices-changed', handler)
  }, [])

  const isDirty = Object.keys(initial).some((key) => form[key] !== initial[key])
  const avatarInvalid = Boolean(form.avatar.trim()) && !isValidAvatar(form.avatar)

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

  async function handleConvertToCatbox() {
    if (converting) {
      catboxCancelledRef.current = true
      catboxAbortRef.current?.abort()
      return
    }
    if (!catboxService) {
      showToast(t('characterCreation:catboxNoService'), { type: 'warning' })
      return
    }
    const validation = validateUploadSize(form.avatar)
    if (!validation.ok) {
      const isGif = form.avatar.includes('image/gif')
      showToast(
        t('characterCreation:catboxSizeLimit', {
          limit: validation.limitMB,
          type: isGif ? 'GIF' : 'image',
        }),
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
      showToast(t('characterCreation:catboxConvertSuccess'), { type: 'success' })
    } catch (err) {
      if (err.name === 'AbortError') {
        if (!catboxCancelledRef.current) {
          showToast(t('characterCreation:catboxConvertError', { error: 'Timed out' }), {
            type: 'error',
          })
        }
      } else {
        showToast(t('characterCreation:catboxConvertError', { error: err.message }), {
          type: 'error',
        })
      }
    } finally {
      clearTimeout(timeoutId)
      catboxAbortRef.current = null
      catboxCancelledRef.current = false
      setConverting(false)
    }
  }

  async function handleConvertToImgchest() {
    if (convertingImgchest) {
      imgchestCancelledRef.current = true
      imgchestAbortRef.current?.abort()
      return
    }
    if (!imgchestService) {
      showToast(t('characterCreation:imgchestNoService'), { type: 'warning' })
      return
    }
    const validation = validateImgchestUploadSize(form.avatar)
    if (!validation.ok) {
      const isGif = form.avatar.includes('image/gif')
      showToast(
        t('characterCreation:imgchestSizeLimit', {
          limit: validation.limitMB,
          type: isGif ? 'GIF' : 'image',
        }),
        { type: 'error' },
      )
      return
    }
    imgchestAbortRef.current?.abort()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)
    imgchestAbortRef.current = controller
    setConvertingImgchest(true)
    try {
      const url = await imgchestUploadAvatar(imgchestService, form.avatar, {
        signal: controller.signal,
      })
      setForm((prev) => ({ ...prev, avatar: url }))
      showToast(t('characterCreation:imgchestConvertSuccess'), { type: 'success' })
    } catch (err) {
      if (err.name === 'AbortError') {
        if (!imgchestCancelledRef.current) {
          showToast(t('characterCreation:imgchestConvertError', { error: 'Timed out' }), {
            type: 'error',
          })
        }
      } else {
        showToast(t('characterCreation:imgchestConvertError', { error: err.message }), {
          type: 'error',
        })
      }
    } finally {
      clearTimeout(timeoutId)
      imgchestAbortRef.current = null
      imgchestCancelledRef.current = false
      setConvertingImgchest(false)
    }
  }

  async function saveLorebook(closeAfter = true) {
    if (avatarInvalid) return
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        avatar: normalizeAvatar(form.avatar),
        description: form.description.trim(),
        scanDepth: form.scanDepth === '' || form.scanDepth == null ? null : Number(form.scanDepth),
        tokenBudget:
          form.tokenBudget === '' || form.tokenBudget == null ? null : Number(form.tokenBudget),
        recursiveScanning: form.recursiveScanning,
        isGlobal: form.isGlobal,
      }
      let id
      if (editing) {
        await updateLorebook(lorebookId, payload)
        id = lorebookId
      } else {
        id = await createLorebook(payload)
        setLorebookId(id)
        setEditing(true)
      }
      setEntries(await getEntriesForLorebook(id))
      if (closeAfter) closeModal()
      return id
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim() || avatarInvalid || saving) return
    await saveLorebook(true)
  }

  async function handleCloseAttempt() {
    const result = await promptSave()
    if (result === 'save') {
      await saveLorebook(true)
    } else if (result === 'discard') {
      closeModal()
    }
  }

  async function addEntry() {
    if (!lorebookId) {
      if (!form.name.trim()) return
      const id = await saveLorebook(false)
      openModal('lorebookEntryForm', { lorebookId: id, entry: null })
    } else {
      openModal('lorebookEntryForm', { lorebookId, entry: null })
    }
  }

  function openEntry(entry) {
    openModal('lorebookEntryForm', { lorebookId, entry })
  }

  async function handleToggleActive(entry) {
    if (entry.id == null) return
    await updateEntry(entry.id, { enabled: !entry.enabled })
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, enabled: !e.enabled } : e)))
  }

  async function handleDeleteEntry(entry) {
    const ok = await confirm({
      title: t('lorebook.form.confirmDeleteEntryTitle'),
      message: t('lorebook.form.confirmDeleteEntry'),
      confirmLabel: t('lorebook.form.deleteEntry'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    })
    if (!ok) return
    if (entry.id != null) {
      await deleteEntry(entry.id)
    }
    setEntries((prev) => prev.filter((e) => e !== entry))
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
      scrollRef={scrollRef}
      onScroll={onScroll}
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
            disabled={!form.name.trim() || avatarInvalid}
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
          <Label
            required
            highlight={Boolean(form.name.trim())}
            description={t('lorebook.form.nameDesc')}
          >
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
          <Label description={t('lorebook.form.avatarDesc')}>{t('lorebook.form.avatar')}</Label>
          <AvatarInput
            value={form.avatar}
            onChange={(v) => setForm((prev) => ({ ...prev, avatar: v }))}
            inputId="lorebook-form-avatar"
            placeholder={t('lorebook.form.avatarPlaceholder')}
            imageDataLabel={t('lorebook.form.avatarImageData', {
              size: formatDataSize(form.avatar.length),
            })}
            clearLabel={t('lorebook.form.avatarClear')}
            uploadLabel={t('lorebook.form.uploadFile')}
            errorText={t('common:avatar.invalid')}
            onZoom={() => openModal('imageViewer', { src: form.avatar, modalSize: 'fullscreen' })}
          />
          {form.avatar.startsWith('data:') && catboxService && (
            <button
              type="button"
              onClick={handleConvertToCatbox}
              disabled={convertingImgchest}
              className="flex items-center gap-1.5 mt-1.5 text-xs text-accent hover:underline disabled:opacity-50"
            >
              <Cloud className="w-3 h-3" />
              {converting
                ? t('characterCreation:cancelConvertToCatbox')
                : t('characterCreation:convertToCatbox')}
            </button>
          )}
          {form.avatar.startsWith('data:') && imgchestService && (
            <button
              type="button"
              onClick={handleConvertToImgchest}
              disabled={converting}
              className="flex items-center gap-1.5 mt-1.5 text-xs text-accent hover:underline disabled:opacity-50"
            >
              <Cloud className="w-3 h-3" />
              {convertingImgchest
                ? t('characterCreation:cancelConvertToImgchest')
                : t('characterCreation:convertToImgchest')}
            </button>
          )}
        </div>

        <CollapsibleSection
          label={t('lorebook.form.description')}
          summary={
            form.description
              ? t('common:tokenCount', { count: estimateTokens(form.description) })
              : null
          }
          storageKey={`lorebookForm.${lorebookId ?? 'new'}.description`}
          defaultExpanded={true}
        >
          <p className="text-xs text-secondary pt-2 pb-1">{t('lorebook.form.descriptionDesc')}</p>
          <AutoResizeTextarea
            className={`${inputClass} resize-none`}
            value={form.description}
            onChange={update('description')}
            placeholder={t('lorebook.form.descriptionPlaceholder')}
            extraHeight={8}
          />
        </CollapsibleSection>

        <CollapsibleSection
          label={t('lorebook.form.globalSettings')}
          storageKey={`lorebookForm.${lorebookId ?? 'new'}.globalSettings`}
          defaultExpanded={false}
        >
          <div className="pt-2 space-y-4">
            <div>
              <Label description={t('lorebook.form.scanDepthDesc')}>
                {t('lorebook.form.scanDepth')}
              </Label>
              <input
                type="number"
                className={inputClass}
                value={form.scanDepth ?? ''}
                onChange={update('scanDepth')}
                placeholder="50"
              />
            </div>
            <div>
              <Label description={t('lorebook.form.tokenBudgetDesc')}>
                {t('lorebook.form.tokenBudget')}
              </Label>
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
              description={t('lorebook.form.recursiveScanningDesc')}
              checked={form.recursiveScanning}
              onChange={(v) => setForm((prev) => ({ ...prev, recursiveScanning: v }))}
            />
            <ToggleRow
              label={t('lorebook.form.isGlobal')}
              description={t('lorebook.form.isGlobalDesc')}
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
              <SortableList
                items={entries}
                getId={(e) => e.id}
                onReorder={(ids) => updateEntryOrder(lorebookId, ids)}
              >
                {(entry, idx) => (
                  <SortableItem id={entry.id} key={entry.id ?? `${entry.name}-${idx}`}>
                    {(sortable) => (
                      <div
                        ref={sortable.setNodeRef}
                        style={sortable.style}
                        className="flex items-center gap-2 border border-border rounded-md p-2 bg-surface"
                      >
                        <DragHandle
                          {...sortable.dragHandleProps}
                          label={t('common:list.actions.reorder')}
                        />
                        <button
                          type="button"
                          onClick={() => openEntryRef.current(entry)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="font-medium text-text text-sm truncate">
                            {entry.name || entry.keys?.[0] || t('lorebook.form.untitledEntry')}
                          </div>
                          {entry.keys?.length > 0 && (
                            <div className="text-xs text-secondary truncate">
                              {entry.keys.join(', ')}
                            </div>
                          )}
                        </button>
                        {!entry.enabled && (
                          <span className="shrink-0 text-[10px] uppercase px-1.5 py-0.5 rounded bg-warning text-on-warning">
                            {t('lorebook.form.disabled')}
                          </span>
                        )}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!!entry.enabled}
                          aria-label={t('lorebook.form.entryActive')}
                          title={t('lorebook.form.entryActive')}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleActive(entry)
                          }}
                          className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md border transition-colors ${
                            entry.enabled
                              ? 'bg-primary text-on-primary border-primary'
                              : 'bg-surface text-tertiary border-border hover:bg-surface-hover'
                          }`}
                        >
                          {entry.enabled ? (
                            <Zap className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEntry(entry)}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center text-on-delete bg-delete hover:bg-delete-hover rounded-md"
                          aria-label={t('lorebook.form.deleteEntry')}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </SortableItem>
                )}
              </SortableList>
            </div>
          )}

          <button
            type="button"
            onClick={() => addEntryRef.current()}
            disabled={!editing && !form.name.trim()}
            className={`w-full mt-2 min-h-[44px] flex items-center justify-center gap-2 border-2 border-dashed rounded-md transition-colors ${
              !editing && !form.name.trim()
                ? 'opacity-50 cursor-not-allowed'
                : 'text-secondary hover:text-text hover:border-border-light border-border'
            }`}
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
