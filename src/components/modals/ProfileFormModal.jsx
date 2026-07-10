import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import { useConfirm } from '../../lib/confirm'
import ModalShell from '../shared/ModalShell'
import {
  PROVIDERS,
  getKeys,
  getCachedModels,
  setCachedModels as persistCachedModels,
  getCachedModelMeta,
  setCachedModelMeta as persistCachedModelMeta,
  getCachedModelNames,
  setCachedModelNames as persistCachedModelNames,
} from '../../services/apiProviders'
import { fetchModels, getCooldownRemaining } from '../../services/modelFetcher'
import { createProfile, updateProfile } from '../../services/connectionProfiles'
import ModelSelect from './settings/controls/ModelSelect'
import SettingSlider from './settings/controls/SettingSlider'
import SettingToggle from './settings/controls/SettingToggle'

function StringListInput({ value, onChange, maxItems }) {
  const { t } = useTranslation('settings')
  const [input, setInput] = useState('')
  const items = Array.isArray(value) ? value : []

  function handleAdd() {
    const raw = input.trim()
    if (!raw) return
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    const available = maxItems ? maxItems - items.length : Infinity
    const toAdd = parts.slice(0, available)
    if (toAdd.length === 0) return
    onChange([...items, ...toAdd])
    setInput('')
  }

  function handleRemove(idx) {
    const next = items.filter((_, i) => i !== idx)
    onChange(next)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  const atLimit = maxItems && items.length >= maxItems

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary-subtle text-primary"
          >
            {item}
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="hover:bg-delete-hover hover:text-on-delete rounded-sm px-0.5"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={atLimit}
          placeholder={atLimit ? t('api.profile.maxStopItems') : t('api.profile.addStopItem')}
          className="flex-1 min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim() || atLimit}
          className="min-h-[44px] px-3 text-sm bg-primary text-on-primary rounded-md hover:bg-primary-hover disabled:opacity-50"
        >
          {t('api.profile.add')}
        </button>
      </div>
    </div>
  )
}

function ProfileFormModal({ profile }) {
  const { t } = useTranslation('settings')
  const { closeModal, setCloseGuard } = useModal()
  const { promptSave } = useSaveConfirm()
  const { confirm } = useConfirm()
  const editing = Boolean(profile)

  const initialRef = useRef({
    name: profile?.name || '',
    providerId: profile?.providerId || '',
    keyId: profile?.keyId || null,
    model: profile?.model || '',
    params: profile?.params ? { ...profile.params } : {},
  })

  const [form, setForm] = useState({ ...initialRef.current })
  const [saving, setSaving] = useState(false)
  const [keys, setKeys] = useState([])
  const [cachedModels, setCachedModels] = useState([])
  const [modelMeta, setModelMeta] = useState({})
  const [modelNames, setModelNames] = useState({})
  const [fetching, setFetching] = useState(false)
  const abortRef = useRef(null)
  const savePendingRef = useRef(false)

  const selectedProvider = PROVIDERS.find((p) => p.id === form.providerId)
  const paramDefs = selectedProvider?.params || []

  useEffect(() => {
    if (selectedProvider) {
      setForm((prev) => {
        const merged = { ...prev.params }
        for (const def of selectedProvider.params) {
          if (!(def.key in merged) && def.default !== undefined && def.default !== null) {
            merged[def.key] = def.default
          }
        }
        return { ...prev, params: merged }
      })
    }
  }, [selectedProvider])

  const isDirty = Object.keys(initialRef.current).some((key) => {
    if (key === 'params')
      return JSON.stringify(form.params) !== JSON.stringify(initialRef.current.params)
    return form[key] !== initialRef.current[key]
  })

  useEffect(() => {
    if (form.providerId) {
      getKeys(form.providerId).then(setKeys)
    } else {
      setKeys([])
    }
  }, [form.providerId])

  const hordeMethod =
    form.providerId === 'ai-horde' ? form.params.hordeMethod || 'native' : undefined

  useEffect(() => {
    if (form.providerId) {
      getCachedModels(form.providerId, hordeMethod).then(setCachedModels)
      if (form.providerId === 'ai-horde') {
        getCachedModelMeta(form.providerId, hordeMethod).then(setModelMeta)
      } else {
        setModelMeta({})
      }
      getCachedModelNames(form.providerId).then(setModelNames)
    } else {
      setCachedModels([])
      setModelMeta({})
      setModelNames({})
    }
  }, [form.providerId, hordeMethod])

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

  function updateParam(paramKey, value) {
    setForm((prev) => ({
      ...prev,
      params: { ...prev.params, [paramKey]: value },
    }))
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        providerId: form.providerId,
        keyId: form.keyId || null,
        model: form.model || null,
        params: { ...form.params },
      }
      if (editing) {
        await updateProfile(profile.id, data)
      } else {
        await createProfile(data)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.providerId || saving) return
    if (selectedProvider?.needsKey && !form.keyId) {
      await confirm({
        title: t('api.profile.form.noKeyWarning.title'),
        message: t('api.profile.form.noKeyWarning.message'),
        confirmLabel: t('ok', { ns: 'common' }),
        cancelLabel: t('cancel', { ns: 'common' }),
      })
    }
    await saveProfile()
    closeModal()
  }

  async function handleRefresh() {
    if (fetching) return
    setFetching(true)
    abortRef.current = new AbortController()
    try {
      const result = await fetchModels(form.providerId, {
        signal: abortRef.current.signal,
        hordeMethod,
      })
      const { models, meta, names } = result
      await persistCachedModels(form.providerId, models, hordeMethod)
      setCachedModels(models)
      if (meta && Object.keys(meta).length > 0) {
        await persistCachedModelMeta(form.providerId, meta, hordeMethod)
        setModelMeta(meta)
      } else {
        setModelMeta({})
      }
      if (names && Object.keys(names).length > 0) {
        await persistCachedModelNames(form.providerId, names)
        setModelNames(names)
      } else {
        setModelNames({})
      }
    } catch (err) {
      if (err.name !== 'AbortError') throw err
    } finally {
      setFetching(false)
      abortRef.current = null
    }
  }

  function handleCancelFetch() {
    abortRef.current?.abort()
    abortRef.current = null
  }

  async function handleCloseAttempt() {
    const result = await promptSave()
    if (result === 'save') {
      await saveProfile()
      closeModal()
    } else if (result === 'discard') {
      closeModal()
    }
  }

  return (
    <ModalShell
      title={editing ? t('api.profile.form.editTitle') : t('api.profile.form.title')}
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
          <button
            type="button"
            onClick={handleSave}
            disabled={!form.name.trim() || !form.providerId || saving}
            className="min-h-[44px] px-6 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm disabled:opacity-50"
          >
            {saving ? t('saving', { ns: 'common' }) : t('save', { ns: 'common' })}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            {t('api.profile.form.name')} <span className="text-error">*</span>
          </label>
          <input
            className="w-full px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm"
            value={form.name}
            onChange={update('name')}
            placeholder={t('api.profile.form.namePlaceholder')}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text mb-1">
            {t('api.profile.form.provider')} <span className="text-error">*</span>
          </label>
          <select
            value={form.providerId}
            onChange={(e) => {
              const nextProvider = e.target.value
              setForm((prev) => ({
                ...prev,
                providerId: nextProvider,
                keyId: null,
                model: '',
                params: {},
              }))
            }}
            className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface text-text text-sm"
          >
            <option value="">{t('api.profile.form.selectProvider')}</option>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {t(p.nameKey.replace('settings:', ''))}
              </option>
            ))}
          </select>
        </div>

        {selectedProvider && selectedProvider.needsKey && (
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t('api.profile.form.apiKey')}
            </label>
            {keys.length === 0 ? (
              <p className="text-xs text-tertiary">{t('api.profile.form.noKeys')}</p>
            ) : (
              <select
                value={form.keyId || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, keyId: e.target.value || null }))}
                className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface text-text text-sm"
              >
                <option value="">{t('api.profile.form.selectKey')}</option>
                {keys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label || maskKey(k.value)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {selectedProvider?.supportsHordeMethods && (
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t('api.profile.form.hordeMethod')}
            </label>
            <select
              value={form.params.hordeMethod || 'native'}
              onChange={(e) => updateParam('hordeMethod', e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface text-text text-sm"
            >
              <option value="native">{t('api.profile.form.hordeMethodNative')}</option>
              <option value="openai-compatible">{t('api.profile.form.hordeMethodOpenAI')}</option>
            </select>
          </div>
        )}

        {selectedProvider && (
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t('api.profile.form.model')}
            </label>
            {selectedProvider.hasModelEndpoint ? (
              <ModelSelect
                providerId={selectedProvider.id}
                value={form.model}
                onChange={(v) => setForm((prev) => ({ ...prev, model: v }))}
                models={cachedModels}
                modelNames={modelNames}
                modelMeta={modelMeta}
                onRefresh={handleRefresh}
                fetching={fetching}
                onCancelFetch={handleCancelFetch}
                cooldownRemaining={getCooldownRemaining()}
              />
            ) : (
              <input
                type="text"
                value={form.model || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
                placeholder={t('api.model.placeholder')}
                className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm"
              />
            )}
          </div>
        )}

        {paramDefs.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-border">
            <p className="text-sm font-medium text-text">{t('api.profile.form.parameters')}</p>
            {paramDefs.map((param) => (
              <div key={param.key}>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {param.label || param.key}
                </label>
                {param.type === 'range' && (
                  <SettingSlider
                    value={form.params[param.key] ?? param.default ?? param.min ?? 0}
                    onChange={(v) => updateParam(param.key, v)}
                    min={param.min ?? 0}
                    max={param.max ?? 100}
                    step={param.step ?? 1}
                  />
                )}
                {param.type === 'boolean' && (
                  <SettingToggle
                    value={form.params[param.key] ?? param.default ?? false}
                    onChange={(v) => updateParam(param.key, v)}
                  />
                )}
                {param.type === 'string-list' && (
                  <StringListInput
                    value={form.params[param.key] ?? []}
                    onChange={(v) => updateParam(param.key, v)}
                    maxItems={param.maxItems}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  )
}

export default ProfileFormModal

function maskKey(value) {
  if (!value || value.length <= 4) return value || ''
  return '••••' + value.slice(-4)
}
