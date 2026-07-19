import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import { useConfirm } from '../../lib/confirm'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'
import Label from '../shared/Label'
import {
  PROVIDERS,
  getKeys,
  getDefaultBaseUrl,
  getCachedModels,
  setCachedModels as persistCachedModels,
  getCachedModelMeta,
  setCachedModelMeta as persistCachedModelMeta,
  getCachedModelNames,
  setCachedModelNames as persistCachedModelNames,
  getCachedModelSupportedParams,
  setCachedModelSupportedParams as persistCachedModelSupportedParams,
} from '../../services/apiProviders'
import { fetchModels, getCooldownRemaining } from '../../services/modelFetcher'
import { createProfile, updateProfile } from '../../services/connectionProfiles'
import ModelSelect from './settings/controls/ModelSelect'
import SettingSlider from './settings/controls/SettingSlider'
import SettingToggle from './settings/controls/SettingToggle'
import { RefreshCw } from '../../lib/icons'

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

const CEREBRAS_REASONING_MAP = {
  'gpt-oss-120b': { options: ['low', 'medium', 'high'], default: 'medium' },
  'zai-glm-4.7': { options: ['none'], default: 'none' },
  'gemma-4-31b': { options: ['none', 'low', 'medium', 'high'], default: 'none' },
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
    baseUrl: profile?.baseUrl || getDefaultBaseUrl(profile?.providerId) || '',
  })

  const [form, setForm] = useState({ ...initialRef.current })
  const [saving, setSaving] = useState(false)
  const [keys, setKeys] = useState([])
  const [cachedModels, setCachedModels] = useState([])
  const [modelMeta, setModelMeta] = useState({})
  const [modelNames, setModelNames] = useState({})
  const [modelSupportedParams, setModelSupportedParams] = useState({})
  const [fetching, setFetching] = useState(false)
  const abortRef = useRef(null)
  const savePendingRef = useRef(false)

  const [providerKeyCounts, setProviderKeyCounts] = useState({})

  const selectedProvider = PROVIDERS.find((p) => p.id === form.providerId)
  const paramDefs = selectedProvider?.params || []

  const isOpenRouter = form.providerId === 'openrouter'
  const isCerebras = selectedProvider?.hasModelReasoning
  const modelParams = form.model ? modelSupportedParams[form.model] || [] : []
  const supportsReasoning = isOpenRouter && modelParams.includes('reasoning')
  const supportsIncludeReasoning = isOpenRouter && modelParams.includes('include_reasoning')
  const showReasoningControls = isOpenRouter && (supportsReasoning || supportsIncludeReasoning)

  const REASONING_EFFORT_OPTIONS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']

  const cerebrasReasoning = isCerebras ? CEREBRAS_REASONING_MAP[form.model] || null : null
  const showCerebrasReasoning = Boolean(cerebrasReasoning)

  useEffect(() => {
    if (selectedProvider) {
      setForm((prev) => {
        const merged = { ...prev.params }
        for (const def of selectedProvider.params) {
          if (!(def.key in merged) && def.default !== undefined && def.default !== null) {
            merged[def.key] = def.default
          }
        }
        if (selectedProvider.supportsLmStudioMethods && !merged.lmStudioMethod) {
          merged.lmStudioMethod = 'openai-compatible'
        }
        return { ...prev, params: merged }
      })
    }
  }, [selectedProvider])

  useEffect(() => {
    if (isCerebras && form.model && CEREBRAS_REASONING_MAP[form.model]) {
      setForm((prev) => ({
        ...prev,
        params: { ...prev.params, reasoning_effort: CEREBRAS_REASONING_MAP[form.model].default },
      }))
    }
  }, [isCerebras, form.model])

  const isDirty = Object.keys(initialRef.current).some((key) => {
    if (key === 'params')
      return JSON.stringify(form.params) !== JSON.stringify(initialRef.current.params)
    return form[key] !== initialRef.current[key]
  })

  useEffect(() => {
    if (form.providerId) {
      getKeys(form.providerId).then((loaded) => {
        setKeys(loaded)
        if (loaded.length > 0 && !form.keyId) {
          const active = loaded.find((k) => k.active)
          setForm((prev) => ({ ...prev, keyId: active ? active.id : loaded[0].id }))
        }
      })
    } else {
      setKeys([])
    }
  }, [form.providerId])

  useEffect(() => {
    let cancelled = false
    Promise.all(
      PROVIDERS.map(async (p) => {
        const k = await getKeys(p.id)
        return [p.id, k.length]
      }),
    ).then((entries) => {
      if (!cancelled) setProviderKeyCounts(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [])

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
      if (form.providerId === 'openrouter') {
        getCachedModelSupportedParams(form.providerId).then(setModelSupportedParams)
      } else {
        setModelSupportedParams({})
      }
    } else {
      setCachedModels([])
      setModelMeta({})
      setModelNames({})
      setModelSupportedParams({})
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
        baseUrl: form.baseUrl || null,
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
        baseUrl: form.baseUrl || null,
      })
      const { models, meta, names, supportedParams } = result
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
      if (supportedParams && Object.keys(supportedParams).length > 0) {
        await persistCachedModelSupportedParams(form.providerId, supportedParams)
        setModelSupportedParams(supportedParams)
      } else if (form.providerId === 'openrouter') {
        setModelSupportedParams({})
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

  async function handleResetParams() {
    const ok = await confirm({
      title: t('api.profile.form.resetParamsConfirm.title'),
      message: t('api.profile.form.resetParamsConfirm.message'),
      confirmLabel: t('api.profile.form.resetParams'),
      cancelLabel: t('cancel', { ns: 'common' }),
      variant: 'danger',
    })
    if (!ok) return
    setForm((prev) => {
      const merged = { ...prev.params }
      for (const def of selectedProvider.params) {
        if (def.default !== undefined && def.default !== null) {
          merged[def.key] = def.default
        } else {
          delete merged[def.key]
        }
      }
      return { ...prev, params: merged }
    })
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
          <SaveButton
            isDirty={isDirty}
            saving={saving}
            disabled={!form.name.trim() || !form.providerId}
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
          <Label required>{t('api.profile.form.name')}</Label>
          <input
            className="w-full px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm"
            value={form.name}
            onChange={update('name')}
            placeholder={t('api.profile.form.namePlaceholder')}
            required
          />
        </div>

        <div>
          <Label required>{t('api.profile.form.provider')}</Label>
          <select
            value={form.providerId}
            onChange={(e) => {
              const nextProvider = e.target.value
              const nextProviderDef = PROVIDERS.find((p) => p.id === nextProvider)
              let keyId = null
              if (nextProviderDef?.needsKey) {
                getKeys(nextProvider).then((nextKeys) => {
                  if (nextKeys.length > 0) {
                    const active = nextKeys.find((k) => k.active)
                    setForm((prev) => ({
                      ...prev,
                      keyId: active ? active.id : nextKeys[0].id,
                    }))
                  }
                })
              }
              setForm((prev) => ({
                ...prev,
                providerId: nextProvider,
                keyId,
                model: '',
                params: {},
                baseUrl: getDefaultBaseUrl(nextProvider) || '',
              }))
            }}
            className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface text-text text-sm"
          >
            <option value="">{t('api.profile.form.selectProvider')}</option>
            {PROVIDERS.map((p) => {
              const noKey = p.needsKey && !providerKeyCounts[p.id]
              return (
                <option key={p.id} value={p.id} disabled={noKey}>
                  {t(p.nameKey.replace('settings:', ''))}
                  {noKey ? ` — ${t('api.profile.form.noApiKey')}` : ''}
                </option>
              )
            })}
          </select>
        </div>

        {selectedProvider && (
          <div>
            <Label>{t('api.profile.form.baseUrl')}</Label>
            <input
              type="url"
              value={form.baseUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
              placeholder={t('api.profile.form.baseUrlPlaceholder')}
              className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm"
            />
          </div>
        )}

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

        {selectedProvider?.supportsLmStudioMethods && (
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              {t('api.profile.form.lmStudioMethod')}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'openai-compatible', labelKey: 'api.profile.form.lmStudioMethodOpenAI' },
                { key: 'native', labelKey: 'api.profile.form.lmStudioMethodNative' },
                { key: 'anthropic', labelKey: 'api.profile.form.lmStudioMethodAnthropic' },
              ].map((opt) => {
                const isActive = (form.params.lmStudioMethod || 'openai-compatible') === opt.key
                const isDisabled = opt.key !== 'openai-compatible'
                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={isDisabled}
                    title={isDisabled ? t('api.profile.form.comingSoon') : undefined}
                    onClick={() => updateParam('lmStudioMethod', opt.key)}
                    className={`min-h-[44px] px-3 py-2 text-sm rounded-md border transition-colors ${
                      isActive
                        ? 'bg-primary text-on-primary border-primary'
                        : isDisabled
                          ? 'bg-surface text-tertiary border-border-light cursor-not-allowed opacity-50'
                          : 'bg-surface text-secondary border-border hover:bg-surface-hover'
                    }`}
                  >
                    {t(opt.labelKey)}
                  </button>
                )
              })}
            </div>
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
                fetching={fetching}
                onCancelFetch={handleCancelFetch}
                cooldownRemaining={getCooldownRemaining()}
                refreshButton={
                  fetching || getCooldownRemaining() > 0 ? null : (
                    <button
                      type="button"
                      onClick={() => handleRefresh(selectedProvider.id)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] text-sm text-secondary hover:bg-surface-hover border border-border rounded-md"
                    >
                      <RefreshCw className="w-4 h-4" />
                      {t('api.refreshModels')}
                    </button>
                  )
                }
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

        {(showReasoningControls || showCerebrasReasoning) && (
          <div className="space-y-4 pt-2 border-t border-border">
            <p className="text-sm font-medium text-text">{t('api.profile.form.reasoning')}</p>
            {supportsReasoning && (
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">
                  {t('api.profile.form.reasoningEffort')}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {REASONING_EFFORT_OPTIONS.map((opt) => {
                    const active = (form.params.reasoning_effort || 'none') === opt
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => updateParam('reasoning_effort', opt)}
                        className={`min-h-[44px] px-3 py-2 text-sm rounded-md border transition-colors ${
                          active
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-surface text-secondary border-border hover:bg-surface-hover'
                        }`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {showCerebrasReasoning && (
              <div>
                <label className="block text-xs font-medium text-secondary mb-1.5">
                  {t('api.profile.form.reasoningEffort')}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {cerebrasReasoning.options.map((opt) => {
                    const active =
                      (form.params.reasoning_effort || cerebrasReasoning.default) === opt
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => updateParam('reasoning_effort', opt)}
                        className={`min-h-[44px] px-3 py-2 text-sm rounded-md border transition-colors ${
                          active
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-surface text-secondary border-border hover:bg-surface-hover'
                        }`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {supportsIncludeReasoning && (
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-secondary">
                  {t('api.profile.form.includeReasoning')}
                </label>
                <SettingToggle
                  value={form.params.include_reasoning ?? false}
                  onChange={(v) => updateParam('include_reasoning', v)}
                />
              </div>
            )}
          </div>
        )}

        {paramDefs.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text">{t('api.profile.form.parameters')}</p>
              <button
                type="button"
                onClick={handleResetParams}
                className="min-h-[44px] px-4 py-2 rounded-md text-sm font-medium border border-border bg-surface text-secondary hover:bg-surface-hover inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {t('api.profile.form.resetParams')}
              </button>
            </div>
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
