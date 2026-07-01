import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PROVIDERS, DEFAULT_MODELS, getActiveProvider, setActiveProvider, getModel, setModel, getBaseUrl, setBaseUrl } from '../../../services/apiProviders'
import CollapsibleSection from '../../shared/CollapsibleSection'
import ApiKeyManager from './controls/ApiKeyManager'
import ModelSelect from './controls/ModelSelect'

function ApiSettingsPanel() {
  const { t } = useTranslation('settings')

  const [loading, setLoading] = useState(true)
  const [activeProvider, setActiveProviderState] = useState(null)
  const [models, setModels] = useState({})
  const [baseUrls, setBaseUrls] = useState({})

  useEffect(() => {
    async function load() {
      const ap = await getActiveProvider()
      setActiveProviderState(ap)

      const mods = {}
      const urls = {}
      for (const p of PROVIDERS) {
        mods[p.id] = await getModel(p.id)
        if (p.needsUrl) {
          urls[p.id] = await getBaseUrl(p.id)
        }
      }
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

  async function handleModelChange(providerId, value) {
    setModels((prev) => ({ ...prev, [providerId]: value }))
    await setModel(providerId, value)
  }

  async function handleBaseUrlChange(providerId, value) {
    setBaseUrls((prev) => ({ ...prev, [providerId]: value }))
    await setBaseUrl(providerId, value)
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
        const currentModel = models[provider.id]
        const defaultModels = DEFAULT_MODELS[provider.id] || []

        return (
          <CollapsibleSection
            key={provider.id}
            label={t(provider.nameKey.replace('settings:', ''))}
            summary={t(provider.descKey.replace('settings:', ''))}
            storageKey={`apiSection.${provider.id}`}
            defaultExpanded={provider.id === activeProvider}
          >
            <div className="space-y-4 pt-2">
              {provider.needsKey && (
                <ApiKeyManager providerId={provider.id} />
              )}

              {provider.supportsAnonymous && (
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
