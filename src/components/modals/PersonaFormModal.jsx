import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import ModalShell from '../shared/ModalShell'
import CollapsibleSection from '../shared/CollapsibleSection'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import Avatar from '../shared/Avatar'
import { createPersona, updatePersona, getAllPersonas } from '../../services/personas'
import { estimateTokens } from '../../services/tokenEstimator'
import { findColorSlot } from '../../config/colorPalettes'
import { useTheme } from '../../hooks/useTheme'
import ColorPicker from '../shared/ColorPicker'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

function PersonaFormModal({ persona }) {
  const { t } = useTranslation('settings')
  const { closeModal, setCloseGuard, openModal } = useModal()
  const { theme } = useTheme()
  const { promptSave } = useSaveConfirm()
  const editing = Boolean(persona)

  const initialRef = useRef({
    name: persona?.name || '',
    title: persona?.title || '',
    avatar: persona?.avatar || '',
    description: persona?.description || '',
    color: persona?.color || '',
    colorSlot: persona?.colorSlot ?? (persona?.color ? findColorSlot(persona.color, 'light') : -1),
    isDefault: Boolean(persona?.isDefault),
  })

  const [form, setForm] = useState({ ...initialRef.current })
  const [saving, setSaving] = useState(false)
  const [isLastDefault, setIsLastDefault] = useState(false)
  const fileRef = useRef(null)
  const savePendingRef = useRef(false)

  const isDirty = Object.keys(initialRef.current).some(
    (key) => form[key] !== initialRef.current[key],
  )

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
  handleCloseRef.current = handleCloseAttempt

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
          <button
            type="button"
            onClick={handleSave}
            disabled={!form.name.trim() || saving}
            className="min-h-[44px] px-6 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm disabled:opacity-50"
          >
            {saving ? t('persona.form.saving') : t('persona.form.save')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            {t('persona.form.inChatName')} <span className="text-error">*</span>
          </label>
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

        <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => {
              if (isLastDefault && !e.target.checked) return
              setForm((prev) => ({ ...prev, isDefault: e.target.checked }))
            }}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            disabled={isLastDefault}
          />
          <span className="text-sm text-text">{t('persona.form.setDefault')}</span>
        </label>
      </div>
    </ModalShell>
  )
}

export default PersonaFormModal
