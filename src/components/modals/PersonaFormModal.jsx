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
import { createPersona, updatePersona, getAllPersonas } from '../../services/personas'
import { estimateTokens } from '../../services/tokenEstimator'
import { findColorSlot } from '../../config/colorPalettes'
import { useTheme } from '../../hooks/useTheme'
import ColorPicker from '../shared/ColorPicker'
import { X } from '../../lib/icons'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm'

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

function PersonaFormModal({ persona }) {
  const { t } = useTranslation('settings')
  const { closeModal, setCloseGuard, openModal } = useModal()
  const { theme } = useTheme()
  const { promptSave } = useSaveConfirm()
  const editing = Boolean(persona)

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
  const fileRef = useRef(null)
  const savePendingRef = useRef(false)

  const isDirty = Object.keys(initial).some((key) => form[key] !== initial[key])

  useEffect(() => {
    if (editing) {
      getAllPersonas().then((all) => {
        if (all.length <= 1 && persona.isDefault) {
          setIsLastDefault(true)
        }
      })
    }
  }, [editing, persona])

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

  async function savePersona() {
    setSaving(true)
    try {
      if (editing) {
        await updatePersona(persona.id, {
          name: form.name.trim(),
          title: form.title.trim(),
          avatar: form.avatar,
          description: form.description.trim(),
          color: form.color,
          colorSlot: form.colorSlot,
          isDefault: form.isDefault,
        })
      } else {
        await createPersona({
          name: form.name.trim(),
          title: form.title.trim(),
          avatar: form.avatar,
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
    if (!form.name.trim() || saving) return
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
            disabled={!form.name.trim()}
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
          <Label required>{t('persona.form.inChatName')}</Label>
          <div className="relative">
            <input
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
          <div className="flex items-center gap-2">
            <Avatar
              src={form.avatar}
              size="2xl"
              className="shrink-0 cursor-pointer"
              onClick={() =>
                openModal('imageViewer', { src: form.avatar, modalSize: 'fullscreen' })
              }
            />
            <div className="relative flex-1">
              {form.avatar.startsWith('data:') ? (
                <input
                  className={`${inputClass} pr-10`}
                  value={t('persona.form.avatarImageData', {
                    size: formatDataSize(form.avatar.length),
                  })}
                  readOnly
                />
              ) : (
                <input
                  className={`${inputClass} pr-10`}
                  value={form.avatar}
                  onChange={update('avatar')}
                  placeholder={t('persona.form.avatarPlaceholder')}
                />
              )}
              {form.avatar && (
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, avatar: '' }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
                  aria-label={t('persona.form.avatarClear')}
                  title={t('persona.form.avatarClear')}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
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
          <label className="block text-sm font-medium text-text mb-2">
            {t('persona.form.colorLabel')}
          </label>
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
