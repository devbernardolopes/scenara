import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'
import Label from '../shared/Label'
import { createService, updateService, SERVICE_TYPES } from '../../services/cloudServices'

function CloudServiceFormModal({ cloudService }) {
  const { t } = useTranslation('settings')
  const { closeModal, setCloseGuard } = useModal()
  const { promptSave } = useSaveConfirm()
  const editing = Boolean(cloudService)

  const selectedType =
    SERVICE_TYPES.find((st) => st.id === cloudService?.serviceType) || SERVICE_TYPES[0]

  const initial = useMemo(
    () => ({
      name: cloudService?.name || '',
      serviceType: cloudService?.serviceType || SERVICE_TYPES[0].id,
      baseUrl: cloudService?.baseUrl || selectedType.defaultBaseUrl || '',
      credentials: {
        ...selectedType.credentialFields.reduce((acc, f) => {
          acc[f.key] = cloudService?.credentials?.[f.key] || ''
          return acc
        }, {}),
      },
    }),
    [],
  )

  const [form, setForm] = useState({ ...initial })
  const [saving, setSaving] = useState(false)
  const savePendingRef = useRef(false)

  const activeType = SERVICE_TYPES.find((st) => st.id === form.serviceType) || SERVICE_TYPES[0]

  const isDirty = Object.keys(initial).some((key) => {
    if (key === 'credentials') {
      return JSON.stringify(form.credentials) !== JSON.stringify(initial.credentials)
    }
    return form[key] !== initial[key]
  })

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

  function updateCredential(fieldKey, value) {
    setForm((prev) => ({
      ...prev,
      credentials: { ...prev.credentials, [fieldKey]: value },
    }))
  }

  async function saveCloudService() {
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        serviceType: form.serviceType,
        baseUrl: form.baseUrl || null,
        credentials: { ...form.credentials },
        metadata: editing ? cloudService.metadata : {},
      }
      if (editing) {
        await updateService(cloudService.id, data)
      } else {
        await createService(data)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim() || saving) return
    await saveCloudService()
    closeModal()
  }

  async function handleCloseAttempt() {
    const result = await promptSave()
    if (result === 'save') {
      await saveCloudService()
      closeModal()
    } else if (result === 'discard') {
      closeModal()
    }
  }

  return (
    <ModalShell
      title={editing ? t('cloudService.form.editTitle') : t('cloudService.form.title')}
      onClose={isDirty ? handleCloseAttempt : closeModal}
      footer={
        <>
          <button
            type="button"
            onClick={isDirty ? handleCloseAttempt : closeModal}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('cancel', { ns: 'common' })}
          </button>
          <SaveButton
            isDirty={isDirty}
            saving={saving}
            disabled={!form.name.trim()}
            onClick={handleSave}
            savingText={t('saving', { ns: 'common' })}
          >
            {t('save', { ns: 'common' })}
          </SaveButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label required>{t('cloudService.form.name')}</Label>
          <input
            className="w-full px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder={t('cloudService.form.namePlaceholder')}
            required
          />
        </div>

        <div>
          <Label required>{t('cloudService.form.serviceType')}</Label>
          <select
            value={form.serviceType}
            onChange={(e) => {
              const nextType = SERVICE_TYPES.find((st) => st.id === e.target.value)
              setForm((prev) => ({
                ...prev,
                serviceType: e.target.value,
                baseUrl: nextType?.defaultBaseUrl || '',
                credentials: nextType
                  ? nextType.credentialFields.reduce((acc, f) => {
                      acc[f.key] = prev.credentials?.[f.key] || ''
                      return acc
                    }, {})
                  : {},
              }))
            }}
            disabled={editing}
            className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text text-sm disabled:opacity-50"
          >
            {SERVICE_TYPES.map((st) => (
              <option key={st.id} value={st.id}>
                {t(st.nameKey.replace('settings:', ''))}
              </option>
            ))}
          </select>
          {activeType.descKey && (
            <p className="text-xs text-tertiary mt-1">
              {t(activeType.descKey.replace('settings:', ''))}
            </p>
          )}
        </div>

        <div>
          <Label>{t('cloudService.form.baseUrl')}</Label>
          <input
            type="url"
            value={form.baseUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
            placeholder={t('cloudService.form.baseUrlPlaceholder')}
            className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm"
          />
        </div>

        {activeType.credentialFields.map((field) => (
          <div key={field.key}>
            <Label>{t(field.labelKey.replace('settings:', ''))}</Label>
            <input
              type={field.type || 'text'}
              value={form.credentials[field.key] || ''}
              onChange={(e) => updateCredential(field.key, e.target.value)}
              placeholder={t(`cloudService.form.credentialPlaceholder`, { field: field.key })}
              className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm"
            />
          </div>
        ))}
      </div>
    </ModalShell>
  )
}

export default CloudServiceFormModal
