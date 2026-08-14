import { useState, useEffect, useRef, useMemo, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import { isValidAvatar, normalizeAvatar } from '../../lib/image'
import { showToast } from '../../lib/toast'
import { Cloud } from '../../lib/icons'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'
import CollapsibleSection from '../shared/CollapsibleSection'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import Label from '../shared/Label'
import AvatarInput from '../shared/AvatarInput'
import { createPersona, updatePersona, getAllPersonas } from '../../services/personas'
import { estimateTokens } from '../../services/tokenEstimator'
import { findColorSlot } from '../../config/colorPalettes'
import { useTheme } from '../../hooks/useTheme'
import ColorPicker from '../shared/ColorPicker'
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

function ToggleRow({ label, checked, onChange, disabled = false }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 min-h-[44px] ${
        disabled ? 'opacity-50' : ''
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

function PersonaFormModal({ persona }) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('characterCreation')
  const { closeModal, setCloseGuard, openModal } = useModal()
  const { theme } = useTheme()
  const { promptSave } = useSaveConfirm()
  const editing = Boolean(persona)
  const formId = useId()

  const initial = useMemo(
    () => ({
      name: persona?.name || '',
      title: persona?.title || '',
      avatar: persona?.avatar || '',
      description: persona?.description || '',
      color: persona?.color || '',
      colorSlot:
        persona?.colorSlot ?? (persona?.color ? findColorSlot(persona.color, 'light') : -1),
      isDefault: Boolean(persona?.isDefault),
    }),
    [],
  )

  const [form, setForm] = useState({ ...initial })
  const [saving, setSaving] = useState(false)
  const [isLastDefault, setIsLastDefault] = useState(false)
  const savePendingRef = useRef(false)
  const [catboxService, setCatboxService] = useState(null)
  const [converting, setConverting] = useState(false)
  const catboxAbortRef = useRef(null)
  const [imgchestService, setImgchestService] = useState(null)
  const [convertingImgchest, setConvertingImgchest] = useState(false)
  const imgchestAbortRef = useRef(null)

  const isDirty = Object.keys(initial).some((key) => form[key] !== initial[key])
  const avatarInvalid = Boolean(form.avatar.trim()) && !isValidAvatar(form.avatar)

  useEffect(() => {
    if (editing) {
      getAllPersonas().then((all) => {
        if (all.length <= 1 && persona.isDefault) {
          setIsLastDefault(true)
        }
      })
    }
  }, [editing, persona])

  useEffect(
    () => () => {
      catboxAbortRef.current?.abort()
      imgchestAbortRef.current?.abort()
    },
    [],
  )

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

  async function handleConvertToCatbox() {
    if (!catboxService) {
      showToast(tc('catboxNoService'), { type: 'warning' })
      return
    }
    const validation = validateUploadSize(form.avatar)
    if (!validation.ok) {
      const isGif = form.avatar.includes('image/gif')
      showToast(
        tc('catboxSizeLimit', { limit: validation.limitMB, type: isGif ? 'GIF' : 'image' }),
        {
          type: 'error',
        },
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
      showToast(tc('catboxConvertSuccess'), { type: 'success' })
    } catch (err) {
      if (err.name === 'AbortError') {
        showToast(tc('catboxConvertError', { error: 'Timed out' }), { type: 'error' })
      } else {
        showToast(tc('catboxConvertError', { error: err.message }), { type: 'error' })
      }
    } finally {
      clearTimeout(timeoutId)
      catboxAbortRef.current = null
      setConverting(false)
    }
  }

  async function handleConvertToImgchest() {
    if (!imgchestService) {
      showToast(tc('imgchestNoService'), { type: 'warning' })
      return
    }
    const validation = validateImgchestUploadSize(form.avatar)
    if (!validation.ok) {
      const isGif = form.avatar.includes('image/gif')
      showToast(
        tc('imgchestSizeLimit', { limit: validation.limitMB, type: isGif ? 'GIF' : 'image' }),
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
      showToast(tc('imgchestConvertSuccess'), { type: 'success' })
    } catch (err) {
      if (err.name === 'AbortError') {
        showToast(tc('imgchestConvertError', { error: 'Timed out' }), { type: 'error' })
      } else {
        showToast(tc('imgchestConvertError', { error: err.message }), { type: 'error' })
      }
    } finally {
      clearTimeout(timeoutId)
      imgchestAbortRef.current = null
      setConvertingImgchest(false)
    }
  }

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

  async function savePersona() {
    if (avatarInvalid) return
    setSaving(true)
    try {
      if (editing) {
        await updatePersona(persona.id, {
          name: form.name.trim(),
          title: form.title.trim(),
          avatar: normalizeAvatar(form.avatar),
          description: form.description.trim(),
          color: form.color,
          colorSlot: form.colorSlot,
          isDefault: form.isDefault,
        })
      } else {
        await createPersona({
          name: form.name.trim(),
          title: form.title.trim(),
          avatar: normalizeAvatar(form.avatar),
          description: form.description.trim(),
          color: form.color,
          colorSlot: form.colorSlot,
          isDefault: form.isDefault,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim() || avatarInvalid || saving) return
    await savePersona()
    closeModal()
  }

  async function handleCloseAttempt() {
    const result = await promptSave()
    if (result === 'save') {
      await savePersona()
      closeModal()
    } else if (result === 'discard') {
      closeModal()
    }
  }

  return (
    <ModalShell
      title={editing ? t('persona.form.editTitle') : t('persona.form.title')}
      onClose={isDirty ? handleCloseAttempt : closeModal}
      footer={
        <>
          <button
            type="button"
            onClick={isDirty ? handleCloseAttempt : closeModal}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('persona.form.cancel')}
          </button>
          <SaveButton
            isDirty={isDirty}
            saving={saving}
            disabled={!form.name.trim() || avatarInvalid}
            onClick={handleSave}
            savingText={t('persona.form.saving')}
          >
            {t('persona.form.save')}
          </SaveButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label required htmlFor={formId + '-name'}>
            {t('persona.form.inChatName')}
          </Label>
          <div className="relative">
            <input
              id={formId + '-name'}
              className={`${inputClass} pr-20`}
              value={form.name}
              onChange={update('name')}
              placeholder={t('persona.form.inChatNamePlaceholder')}
              required
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-tertiary">
              {estimateTokens(form.name)} tokens
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1" htmlFor={formId + '-title'}>
            {t('persona.form.displayName')}
          </label>
          <input
            id={formId + '-title'}
            className={inputClass}
            value={form.title}
            onChange={update('title')}
            placeholder={t('persona.form.displayNamePlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1" htmlFor={formId + '-avatar'}>
            {t('persona.form.avatarLabel')}
          </label>
          <AvatarInput
            value={form.avatar}
            onChange={(v) => setForm((prev) => ({ ...prev, avatar: v }))}
            inputId={formId + '-avatar'}
            placeholder={t('persona.form.avatarPlaceholder')}
            imageDataLabel={t('persona.form.avatarImageData', {
              size: formatDataSize(form.avatar.length),
            })}
            clearLabel={t('persona.form.avatarClear')}
            uploadLabel={t('persona.form.uploadFile')}
            errorText={t('common:avatar.invalid')}
            onZoom={() => openModal('imageViewer', { src: form.avatar, modalSize: 'fullscreen' })}
          />
          {form.avatar.startsWith('data:') && catboxService && (
            <button
              type="button"
              onClick={handleConvertToCatbox}
              disabled={converting}
              className="flex items-center gap-1.5 mt-1.5 text-xs text-accent hover:underline disabled:opacity-50"
            >
              <Cloud className="w-3 h-3" />
              {converting ? tc('convertingToCatbox') : tc('convertToCatbox')}
            </button>
          )}
          {form.avatar.startsWith('data:') && imgchestService && (
            <button
              type="button"
              onClick={handleConvertToImgchest}
              disabled={convertingImgchest}
              className="flex items-center gap-1.5 mt-1.5 text-xs text-accent hover:underline disabled:opacity-50"
            >
              <Cloud className="w-3 h-3" />
              {convertingImgchest ? tc('convertingToImgchest') : tc('convertToImgchest')}
            </button>
          )}
        </div>

        <CollapsibleSection
          label={t('persona.form.descriptionLabel')}
          summary={
            form.description
              ? t('common:tokenCount', { count: estimateTokens(form.description) })
              : null
          }
          storageKey="personaFormDescription"
          defaultExpanded={true}
        >
          <AutoResizeTextarea
            className={`${inputClass} resize-none mt-2`}
            value={form.description}
            onChange={update('description')}
            placeholder={t('persona.form.descriptionPlaceholder')}
            extraHeight={8}
          />
        </CollapsibleSection>

        <div>
          <span className="block text-sm font-medium text-text mb-2">
            {t('persona.form.colorLabel')}
          </span>
          <ColorPicker
            value={form.color}
            onChange={(c) => {
              const slot = c ? findColorSlot(c, theme) : -1
              setForm((prev) => ({ ...prev, color: c, colorSlot: slot }))
            }}
            theme={theme}
          />
        </div>

        <ToggleRow
          label={t('persona.form.setDefault')}
          checked={form.isDefault}
          disabled={isLastDefault}
          onChange={(v) => {
            if (isLastDefault && !v) return
            setForm((prev) => ({ ...prev, isDefault: v }))
          }}
        />
      </div>
    </ModalShell>
  )
}

export default PersonaFormModal
