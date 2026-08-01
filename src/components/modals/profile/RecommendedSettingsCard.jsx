import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  loadRecommendations,
  findModelRecommendation,
} from '../../../services/hordeRecommendations'
import { filterParamsForProvider } from '../../../services/samplingParams'
import { RefreshCw } from '../../../lib/icons'

function RecommendedSettingsCard({ modelId, onApplyParams, onApplyTemplate, onApplyStop }) {
  const { t } = useTranslation('settings')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [presetId, setPresetId] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadRecommendations().then((d) => {
      if (cancelled) return
      setData(d)
      setLoading(false)
      const rec = findModelRecommendation(d, modelId)
      if (rec?.presets?.length) setPresetId(rec.presets[0].id)
    })
    return () => {
      cancelled = true
    }
  }, [modelId])

  async function handleRefresh() {
    if (loading) return
    setLoading(true)
    const d = await loadRecommendations({ force: true })
    setData(d)
    setLoading(false)
    const rec = findModelRecommendation(d, modelId)
    if (rec?.presets?.length) setPresetId(rec.presets[0].id)
  }

  const modelRec = findModelRecommendation(data, modelId)
  const presets = modelRec?.presets || []
  const activePreset = presets.find((p) => p.id === presetId) || presets[0] || null

  if (loading) {
    return (
      <div className="pt-2 border-t border-border">
        <p className="text-xs text-tertiary">{t('api.profile.form.recommended.loading')}</p>
      </div>
    )
  }

  if (!modelRec) {
    return (
      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <p className="text-sm text-secondary">{t('api.profile.form.recommended.none')}</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="min-h-[44px] px-3 text-sm text-secondary hover:text-text inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            {t('api.profile.form.recommended.refresh')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-2 border-t border-border">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text">{t('api.profile.form.recommended.title')}</p>
        <button
          type="button"
          onClick={handleRefresh}
          className="min-h-[44px] px-3 text-sm text-secondary hover:text-text inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-4 h-4" />
          {t('api.profile.form.recommended.refresh')}
        </button>
      </div>

      <div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium text-text">{modelRec.name}</span>
          {modelRec.homepage && (
            <a
              href={modelRec.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline"
            >
              {t('api.profile.form.recommended.source')}
            </a>
          )}
        </div>

        {presets.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {presets.map((p) => {
              const active = activePreset?.id === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPresetId(p.id)}
                  className={`min-h-[44px] px-3 py-2 text-sm rounded-md border transition-colors ${
                    active
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface text-secondary border-border hover:bg-surface-hover'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        )}

        {activePreset?.description && (
          <p className="text-xs text-secondary mt-1.5">{activePreset.description}</p>
        )}

        <div className="flex flex-wrap gap-1.5 mt-2">
          <button
            type="button"
            onClick={() =>
              onApplyParams(filterParamsForProvider(activePreset.params, 'ai-horde', 'native'))
            }
            className="min-h-[44px] px-3 py-2 text-sm rounded-md border border-border bg-surface text-secondary hover:bg-surface-hover"
          >
            {t('api.profile.form.recommended.applyParams', {
              count: Object.keys(activePreset.params).length,
            })}
          </button>
          {activePreset.promptTemplate && (
            <button
              type="button"
              onClick={() => onApplyTemplate(activePreset.promptTemplate)}
              className="min-h-[44px] px-3 py-2 text-sm rounded-md border border-border bg-surface text-secondary hover:bg-surface-hover"
            >
              {t('api.profile.form.recommended.applyTemplate')}
            </button>
          )}
          {activePreset.stopSequences?.length > 0 && (
            <button
              type="button"
              onClick={() => onApplyStop(activePreset.stopSequences)}
              className="min-h-[44px] px-3 py-2 text-sm rounded-md border border-border bg-surface text-secondary hover:bg-surface-hover"
            >
              {t('api.profile.form.recommended.applyStop', {
                count: activePreset.stopSequences.length,
              })}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default RecommendedSettingsCard
