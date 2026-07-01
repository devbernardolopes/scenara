import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PROVIDERS, DEFAULT_MODELS, getActiveProvider, setActiveProvider, getApiKey, setApiKey, removeApiKey, getModel, setModel, getBaseUrl, setBaseUrl } from '../../../services/apiProviders'
import { useConfirm } from '../../../lib/confirm'
import CollapsibleSection from '../../shared/CollapsibleSection'
import ModelSelect from './controls/ModelSelect'
import { Eye, EyeOff, Key } from '../../../lib/icons'

function ApiSettingsPanel() {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()

  const [loading, setLoading] = useState(true)
  const [activeProvider, setActiveProviderState] = useState(null)
  const [apiKeys, setApiKeys] = useState({})
  const [models, setModels] = useState({})
  const [baseUrls, setBaseUrls] = useState({})
  const [visibleKeys, setVisibleKeys] = useState({})

  useEffect(() => {
    async function load() {
      const ap = await getActiveProvider()
      setActiveProviderState(ap)

      const keys = {}
      const mods = {}
      const urls = {}
      for (const p of PROVIDERS) {
        keys[p.id] = await getApiKey(p.id)
        mods[p.id] = await getModel(p.id)
        if (p.needsUrl) {
          urls[p.id] = await getBaseUrl(p.id)
        }
      }
      setApiKeys(keys)
      setModels(mods)
      setBaseUrls(urls)
      setLoading(false)
    }
    load()
  }, [])

  function handleActiveProviderChange(e) {
    const next = e.target.value
    setActiveProviderState(next)
    setActiveProvider(next)
  }

  async function handleApiKeyChange(providerId, value) {
    setApiKeys((prev) => ({ ...prev, [providerId]: value }))
    if (value) {
      await setApiKey(providerId, value)
    } else {
      await removeApiKey(providerId)
    }
  }

  async function handleModelChange(providerId, value) {
    setModels((prev) => ({ ...prev, [providerId]: value }))
    await setModel(providerId, value)
  }

  async function handleBaseUrlChange(providerId, value) {
    setBaseUrls((prev) => ({ ...prev, [providerId]: value }))
    await setBaseUrl(providerId, value)
  }

  async function handleRemoveKey(providerId) {
    const confirmed = await confirm({
      title: t('api.removeKeyConfirm.title'),
      message: t('api.removeKeyConfirm.message'),
      confirmLabel: t('api.removeKey'),
      cancelLabel: t('cancel', { ns: 'common' }),
      variant: 'danger',
    })
    if (confirmed) {
      setApiKeys((prev) => ({ ...prev, [providerId]: null }))
      await removeApiKey(providerId)
    }
  }

  function handleUseTrialKey(providerId) {
    const provider = PROVIDERS.find((p) => p.id === providerId)
    if (!provider?.trialKey) return
    handleApiKeyChange(providerId, provider.trialKey)
  }

  function toggleKeyVisibility(providerId) {
    setVisibleKeys((prev) => ({ ...prev, [providerId]: !prev[providerId] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-tertiary">{t('loading', { ns: 'common' })}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text">
          {t('api.activeProvider.label')}
        </label>
        <select
          value={activeProvider || ''}
          onChange={handleActiveProviderChange}
          className="w-full sm:w-72 px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface text-text text-sm"
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {t(p.nameKey.replace('settings:', ''))}
            </option>
          ))}
        </select>
      </div>

      {PROVIDERS.map((provider) => {
        const hasKey = !!apiKeys[provider.id]
        const currentModel = models[provider.id]
        const defaultModels = DEFAULT_MODELS[provider.id] || []

        return (
          <CollapsibleSection
            key={provider.id}
            label={t(provider.nameKey.replace('settings:', ''))}
            summary={t(provider.descKey.replace('settings:', ''))}
            storageKey={`apiSection.${provider.id}`}
            hasContent={hasKey}
            defaultExpanded={provider.id === activeProvider}
          >
            <div className="space-y-4 pt-2">
              {provider.needsKey && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-secondary">
                    {t('api.apiKey.label')}
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={visibleKeys[provider.id] ? 'text' : 'password'}
                        value={apiKeys[provider.id] || ''}
                        onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                        placeholder={t('api.apiKey.placeholder')}
                        className="w-full min-h-[44px] pl-3 pr-10 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => toggleKeyVisibility(provider.id)}
                        className="absolute right-0 top-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
                        aria-label={visibleKeys[provider.id] ? 'Hide API key' : 'Show API key'}
                      >
                        {visibleKeys[provider.id] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {hasKey && (
                      <button
                        type="button"
                        onClick={() => handleRemoveKey(providerId)}
                        className="shrink-0 min-h-[44px] px-3 text-sm text-error hover:opacity-80"
                      >
                        {t('api.removeKey')}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUseTrialKey(provider.id)}
                    className="self-start text-xs text-primary hover:underline min-h-[44px] flex items-center gap-1"
                  >
                    <Key className="w-3 h-3" />
                    {t('api.useTrialKey')}
                  </button>
                </div>
              )}

              {provider.supportsAnonymous && !hasKey && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-subtle text-primary">
                  {t('api.anonymousBadge')}
                </span>
              )}

              {provider.needsUrl && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-secondary">
                    {t('api.serverUrl.label')}
                  </label>
                  <input
                    type="url"
                    value={baseUrls[provider.id] || ''}
                    onChange={(e) => handleBaseUrlChange(provider.id, e.target.value)}
                    placeholder={t('api.serverUrl.placeholder')}
                    className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm"
                  />
                </div>
              )}

              {provider.hasModelEndpoint ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-secondary">
                    {t('api.model.label')}
                  </label>
                  <ModelSelect
                    providerId={provider.id}
                    value={currentModel}
                    onChange={(v) => handleModelChange(provider.id, v)}
                    models={defaultModels}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-secondary">
                    {t('api.model.label')}
                  </label>
                  <input
                    type="text"
                    value={currentModel || ''}
                    onChange={(e) => handleModelChange(provider.id, e.target.value)}
                    placeholder={t('api.model.placeholder')}
                    className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm"
                  />
                </div>
              )}

              {provider.paramLimits.stopMax && (
                <p className="text-xs text-secondary">
                  {t('api.stopLimitNote', { max: provider.paramLimits.stopMax })}
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  // Placeholder: will test connection later
                  console.log('Test connection for', provider.id)
                }}
                className="min-h-[44px] px-4 text-sm border border-border rounded-md bg-surface text-secondary hover:bg-surface-hover"
              >
                {t('api.testConnection')}
              </button>
            </div>
          </CollapsibleSection>
        )
      })}
    </div>
  )
}

export default ApiSettingsPanel
