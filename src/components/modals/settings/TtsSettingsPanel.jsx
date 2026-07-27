import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../../lib/confirm'
import { showToast } from '../../../lib/toast'
import { getSetting, setSetting } from '../../../services/settings'
import {
  KITTEN_TTS_MODELS,
  KITTEN_TTS_VOICES,
  checkTtsCache,
  downloadTtsModel,
  loadTtsModel,
  unloadTtsModel,
  deleteTtsModel,
  previewTtsModel,
  onModelLoading,
} from '../../../lib/inferenceClient'
import CollapsibleSection from '../../shared/CollapsibleSection'
import SettingSlider from './controls/SettingSlider'
import { Download, Trash2, Play, Volume2, Loader, HardDrive, Square } from '../../../lib/icons'

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function StatusChip({ status, t }) {
  const map = {
    'not-downloaded': 'bg-surface-secondary text-tertiary',
    downloading: 'bg-primary/10 text-primary',
    loading: 'bg-primary/10 text-primary',
    downloaded: 'bg-success/10 text-success',
    loaded: 'bg-accent/10 text-accent',
    error: 'bg-error/10 text-error',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || map['not-downloaded']}`}
    >
      {(status === 'downloading' || status === 'loading') && (
        <Loader className="w-3 h-3 mr-1 animate-spin" />
      )}
      {t(`tts.kitten.status.${status}`)}
    </span>
  )
}

function ProgressBar({ progress }) {
  const pct = Math.round((progress || 0) * 100)
  return (
    <div className="w-full h-1.5 bg-surface-secondary rounded-full overflow-hidden">
      <div
        className="h-full bg-primary rounded-full transition-all duration-200"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function KittenModelCard({
  model,
  state,
  loadedBackend,
  t,
  onDownload,
  onLoad,
  onUnload,
  onDelete,
  disabled,
}) {
  const status = state?.status || 'not-downloaded'
  const isDownloading = status === 'downloading'
  const isLoading = status === 'loading'
  const isLoaded = status === 'loaded'
  const isDownloaded = status === 'downloaded' || isLoaded
  const isError = status === 'error'

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text">{t(model.labelKey)}</span>
            <span className="text-xs text-tertiary">{model.params}</span>
            <span className="text-xs text-tertiary">~{model.approxSize}</span>
            {isLoaded && loadedBackend && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                {t(`tts.kitten.backend.${loadedBackend}`)}
              </span>
            )}
          </div>
          <p className="text-xs text-secondary mt-0.5">{t(model.descKey)}</p>
        </div>
        <StatusChip status={status} t={t} />
      </div>

      {isDownloading && (
        <div className="space-y-1">
          <ProgressBar progress={state?.progress} />
          <p className="text-xs text-tertiary text-right">
            {Math.round((state?.progress || 0) * 100)}%
          </p>
        </div>
      )}

      {isLoading && (
        <div className="space-y-1">
          <ProgressBar progress={null} />
        </div>
      )}

      {isError && <p className="text-xs text-error">Download or load failed. Try again.</p>}

      <div className="flex items-center gap-2 flex-wrap">
        {!isDownloaded && !isDownloading && !isLoading && (
          <button
            type="button"
            onClick={onDownload}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-md bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {t('tts.kitten.actions.download')}
          </button>
        )}
        {isDownloading && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-md bg-primary/10 text-primary">
            <Loader className="w-3.5 h-3.5 animate-spin" />
            {t('tts.kitten.actions.downloading')}
          </span>
        )}
        {isLoading && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-md bg-primary/10 text-primary">
            <Loader className="w-3.5 h-3.5 animate-spin" />
            {t('tts.kitten.actions.loading')}
          </span>
        )}
        {isDownloaded && !isLoaded && !isLoading && (
          <button
            type="button"
            onClick={onLoad}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-md bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            {t('tts.kitten.actions.load')}
          </button>
        )}
        {isLoaded && (
          <button
            type="button"
            onClick={onUnload}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-md bg-surface-secondary text-text hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('tts.kitten.actions.unload')}
          </button>
        )}
        {isDownloaded && (
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-md text-error hover:bg-error/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('tts.kitten.actions.delete')}
          </button>
        )}
      </div>
    </div>
  )
}

function TtsSettingsPanel() {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()

  const [activeProvider, setActiveProvider] = useState('browser')
  const [backend, setBackend] = useState('auto')
  const [browserVoice, setBrowserVoice] = useState('')
  const [kittenVoice, setKittenVoice] = useState('Leo')
  const [browserRate, setBrowserRate] = useState(1)
  const [browserPitch, setBrowserPitch] = useState(1)
  const [browserVolume, setBrowserVolume] = useState(1)
  const [kittenSpeed, setKittenSpeed] = useState(1)
  const [browserVoices, setBrowserVoices] = useState([])
  const [modelStates, setModelStates] = useState({})
  const [storageInfo, setStorageInfo] = useState(null)
  const [actionDisabled, setActionDisabled] = useState(false)
  const [hasWebGPU] = useState(() => typeof navigator !== 'undefined' && !!navigator.gpu)
  const [loadedBackend, setLoadedBackend] = useState(null)
  const [previewPhase, setPreviewPhase] = useState('idle')
  const [browserPreviewPhase, setBrowserPreviewPhase] = useState('idle')
  const previewAudioRef = useRef(null)

  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [
        provider,
        backendVal,
        browserVoiceVal,
        kittenVoiceVal,
        browserRateVal,
        browserPitchVal,
        browserVolumeVal,
        kittenSpeedVal,
      ] = await Promise.all([
        getSetting('tts.provider'),
        getSetting('tts.backend'),
        getSetting('tts.browserVoice'),
        getSetting('tts.kittenVoice'),
        getSetting('tts.browserRate'),
        getSetting('tts.browserPitch'),
        getSetting('tts.browserVolume'),
        getSetting('tts.kittenSpeed'),
      ])
      if (cancelled) return
      if (provider) setActiveProvider(provider)
      if (backendVal) setBackend(backendVal)
      if (browserVoiceVal) setBrowserVoice(browserVoiceVal)
      if (kittenVoiceVal) setKittenVoice(kittenVoiceVal)
      if (browserRateVal != null) setBrowserRate(browserRateVal)
      if (browserPitchVal != null) setBrowserPitch(browserPitchVal)
      if (browserVolumeVal != null) setBrowserVolume(browserVolumeVal)
      if (kittenSpeedVal != null) setKittenSpeed(kittenSpeedVal)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices() || []
      setBrowserVoices(voices)
    }
    loadVoices()
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function checkAll() {
      const states = {}
      for (const model of KITTEN_TTS_MODELS) {
        try {
          const result = await checkTtsCache(model.key)
          if (cancelled) return
          states[model.key] = {
            status: result.loaded ? 'loaded' : result.cached ? 'downloaded' : 'not-downloaded',
          }
          if (result.storageInfo) setStorageInfo(result.storageInfo)
        } catch {
          if (cancelled) return
          states[model.key] = { status: 'error' }
        }
      }
      if (!cancelled) setModelStates(states)
    }
    checkAll()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onModelLoading((data) => {
      if (!data.modelKey?.startsWith('kitten-')) return
      setModelStates((prev) => {
        const current = prev[data.modelKey]
        if (current?.status === 'loading') return prev
        return {
          ...prev,
          [data.modelKey]: {
            ...current,
            status:
              data.status === 'done'
                ? 'downloaded'
                : data.status === 'error'
                  ? 'error'
                  : 'downloading',
            progress: data.progress,
            loaded: data.loaded,
            total: data.total,
          },
        }
      })
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current = null
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const saveProvider = useCallback(async (val) => {
    setActiveProvider(val)
    await setSetting('tts.provider', val)
  }, [])

  const saveBackend = useCallback(async (val) => {
    setBackend(val)
    await setSetting('tts.backend', val)
  }, [])

  const saveBrowserVoice = useCallback(async (val) => {
    setBrowserVoice(val)
    await setSetting('tts.browserVoice', val)
  }, [])

  const saveKittenVoice = useCallback(async (val) => {
    setKittenVoice(val)
    await setSetting('tts.kittenVoice', val)
  }, [])

  const saveBrowserRate = useCallback(async (val) => {
    setBrowserRate(val)
    await setSetting('tts.browserRate', val)
  }, [])

  const saveBrowserPitch = useCallback(async (val) => {
    setBrowserPitch(val)
    await setSetting('tts.browserPitch', val)
  }, [])

  const saveBrowserVolume = useCallback(async (val) => {
    setBrowserVolume(val)
    await setSetting('tts.browserVolume', val)
  }, [])

  const saveKittenSpeed = useCallback(async (val) => {
    setKittenSpeed(val)
    await setSetting('tts.kittenSpeed', val)
  }, [])

  const handleBrowserPreview = useCallback(() => {
    if (!window.speechSynthesis) return

    if (browserPreviewPhase === 'playing') {
      window.speechSynthesis.cancel()
      setBrowserPreviewPhase('idle')
      return
    }

    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(t('tts.browser.previewText'))
    const voice = browserVoices.find((v) => v.name === browserVoice)
    if (voice) utt.voice = voice
    utt.rate = browserRate
    utt.pitch = browserPitch
    utt.volume = browserVolume
    setBrowserPreviewPhase('playing')
    utt.onend = () => setBrowserPreviewPhase('idle')
    utt.onerror = () => setBrowserPreviewPhase('idle')
    window.speechSynthesis.speak(utt)
  }, [
    browserVoice,
    browserVoices,
    browserRate,
    browserPitch,
    browserVolume,
    browserPreviewPhase,
    t,
  ])

  const withActionLock = useCallback(
    (fn) => async () => {
      setActionDisabled(true)
      try {
        await fn()
      } finally {
        setActionDisabled(false)
      }
    },
    [],
  )

  const handleDownload = useCallback(
    (modelKey) =>
      withActionLock(async () => {
        setModelStates((prev) => ({
          ...prev,
          [modelKey]: { ...prev[modelKey], status: 'downloading', progress: 0 },
        }))
        try {
          await downloadTtsModel(modelKey)
          setModelStates((prev) => ({
            ...prev,
            [modelKey]: { ...prev[modelKey], status: 'downloaded', progress: 1 },
          }))
          const info = await checkTtsCache(modelKey)
          if (info.storageInfo) setStorageInfo(info.storageInfo)
        } catch (err) {
          showToast(err.message || 'Download failed', { type: 'error' })
          setModelStates((prev) => ({
            ...prev,
            [modelKey]: { ...prev[modelKey], status: 'error' },
          }))
        }
      })(),
    [withActionLock],
  )

  const handleLoad = useCallback(
    (modelKey) =>
      withActionLock(async () => {
        const currentlyLoaded = KITTEN_TTS_MODELS.find(
          (m) => m.key !== modelKey && modelStates[m.key]?.status === 'loaded',
        )
        if (currentlyLoaded) {
          try {
            await unloadTtsModel(currentlyLoaded.key)
          } catch {
            /* ignore — may already be gone */
          }
        }

        setModelStates((prev) => {
          const next = { ...prev }
          if (currentlyLoaded) {
            next[currentlyLoaded.key] = {
              ...next[currentlyLoaded.key],
              status: 'downloaded',
            }
          }
          next[modelKey] = { ...next[modelKey], status: 'loading', progress: 0 }
          return next
        })

        try {
          const result = await loadTtsModel(modelKey, backend)
          setModelStates((prev) => ({
            ...prev,
            [modelKey]: { ...prev[modelKey], status: 'loaded' },
          }))
          if (result.actualBackend) {
            setLoadedBackend(result.actualBackend)
          }
          await saveProvider(modelKey)
          const backendLabel = t(`tts.kitten.backend.${result.actualBackend || backend}`)
          showToast(`${backendLabel} — ${t('tts.kitten.status.loaded')}`, { type: 'success' })
        } catch (err) {
          showToast(err.message || 'Load failed', { type: 'error' })
          setModelStates((prev) => ({
            ...prev,
            [modelKey]: { ...prev[modelKey], status: 'error' },
          }))
        }
      })(),
    [backend, modelStates, withActionLock, saveProvider, t],
  )

  const handleUnload = useCallback(
    (modelKey) =>
      withActionLock(async () => {
        try {
          await unloadTtsModel(modelKey)
          setModelStates((prev) => ({
            ...prev,
            [modelKey]: { ...prev[modelKey], status: 'downloaded' },
          }))
          setLoadedBackend(null)
          await saveProvider('browser')
        } catch (err) {
          showToast(err.message || 'Unload failed', { type: 'error' })
        }
      })(),
    [withActionLock, saveProvider],
  )

  const handleDelete = useCallback(
    (modelKey) =>
      withActionLock(async () => {
        const ok = await confirm({
          title: t('tts.kitten.confirmDeleteTitle'),
          message: t('tts.kitten.confirmDeleteMessage'),
          confirmLabel: t('common:confirm'),
          cancelLabel: t('common:cancel'),
          variant: 'danger',
        })
        if (!ok) return
        try {
          await deleteTtsModel(modelKey)
          setModelStates((prev) => ({
            ...prev,
            [modelKey]: { status: 'not-downloaded' },
          }))
        } catch (err) {
          showToast(err.message || 'Delete failed', { type: 'error' })
        }
      })(),
    [confirm, t, withActionLock],
  )

  const handleKittenPreview = useCallback(async () => {
    if (!activeProvider || activeProvider === 'browser') return
    if (modelStates[activeProvider]?.status !== 'loaded') return

    if (previewPhase === 'playing') {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current = null
      }
      setPreviewPhase('idle')
      return
    }

    setPreviewPhase('loading')
    try {
      const result = await previewTtsModel(activeProvider, kittenVoice, undefined, kittenSpeed)
      if (result?.audio) {
        const blob = new Blob([result.audio], { type: 'audio/wav' })
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        previewAudioRef.current = audio
        setPreviewPhase('playing')
        audio.onended = () => {
          URL.revokeObjectURL(url)
          previewAudioRef.current = null
          setPreviewPhase('idle')
        }
        audio.onerror = () => {
          URL.revokeObjectURL(url)
          previewAudioRef.current = null
          setPreviewPhase('idle')
        }
        await audio.play()
      } else {
        setPreviewPhase('idle')
      }
    } catch (err) {
      showToast(err.message || 'Preview failed', { type: 'error' })
      setPreviewPhase('idle')
    }
  }, [activeProvider, modelStates, kittenVoice, kittenSpeed, previewPhase])

  return (
    <div className="space-y-8">
      <p className="text-xs text-secondary">{t('tts.panelDesc')}</p>

      {/* Browser TTS */}
      <CollapsibleSection
        label={t('tts.browser.title')}
        summary={activeProvider === 'browser' ? 'Active' : ''}
        hasContent={activeProvider === 'browser'}
        storageKey="tts.browser"
      >
        <div className="space-y-4">
          <p className="text-xs text-secondary">{t('tts.browser.desc')}</p>

          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t('tts.browser.voice.label')}
            </label>
            <select
              value={browserVoice}
              onChange={(e) => saveBrowserVoice(e.target.value)}
              className="w-full px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface text-text text-sm"
            >
              {browserVoices.length === 0 && <option>{t('tts.browser.noVoices')}</option>}
              {browserVoices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <p className="text-xs text-secondary mt-1">{t('tts.browser.voice.desc')}</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-text mb-1">
                {t('tts.browser.rate.label')}
              </label>
              <SettingSlider
                value={browserRate}
                onChange={saveBrowserRate}
                min={0.5}
                max={2}
                step={0.1}
                label={t('tts.browser.rate.label')}
              />
              <p className="text-xs text-secondary mt-1">{t('tts.browser.rate.desc')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-1">
                {t('tts.browser.pitch.label')}
              </label>
              <SettingSlider
                value={browserPitch}
                onChange={saveBrowserPitch}
                min={0.5}
                max={1.5}
                step={0.1}
                label={t('tts.browser.pitch.label')}
              />
              <p className="text-xs text-secondary mt-1">{t('tts.browser.pitch.desc')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-1">
                {t('tts.browser.volume.label')}
              </label>
              <SettingSlider
                value={browserVolume}
                onChange={saveBrowserVolume}
                min={0}
                max={1}
                step={0.05}
                label={t('tts.browser.volume.label')}
              />
              <p className="text-xs text-secondary mt-1">{t('tts.browser.volume.desc')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleBrowserPreview}
            disabled={
              browserPreviewPhase === 'idle' && (!browserVoice || browserVoices.length === 0)
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-md bg-surface-secondary text-text hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {browserPreviewPhase === 'playing' ? (
              <Square className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
            {browserPreviewPhase === 'playing' ? t('chat:stop') : t('tts.browser.preview')}
          </button>

          <button
            type="button"
            onClick={() => saveProvider('browser')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-md transition-colors ${
              activeProvider === 'browser'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-secondary text-text hover:bg-surface-hover'
            }`}
          >
            {activeProvider === 'browser' ? 'Active' : 'Set as active'}
          </button>
        </div>
      </CollapsibleSection>

      {/* Kitten TTS */}
      <CollapsibleSection
        label={t('tts.kitten.title')}
        summary={
          KITTEN_TTS_MODELS.some((m) => {
            const s = modelStates[m.key]?.status
            return s === 'loaded' || s === 'downloaded'
          })
            ? KITTEN_TTS_MODELS.filter((m) => modelStates[m.key]?.status === 'loaded').length
              ? `${KITTEN_TTS_MODELS.filter((m) => modelStates[m.key]?.status === 'loaded').length} loaded`
              : 'Downloaded'
            : ''
        }
        hasContent={KITTEN_TTS_MODELS.some((m) => {
          const s = modelStates[m.key]?.status
          return s === 'loaded' || s === 'downloaded'
        })}
        storageKey="tts.kitten"
      >
        <div className="space-y-4">
          <p className="text-xs text-secondary">{t('tts.kitten.desc')}</p>

          {isIOS && <p className="text-xs text-warning">{t('tts.kitten.iosWarning')}</p>}

          {/* Storage info */}
          {storageInfo && (
            <div className="flex items-center gap-1.5 text-xs text-tertiary">
              <HardDrive className="w-3.5 h-3.5" />
              <span>
                {t('tts.kitten.storageUsed', {
                  used: formatBytes(storageInfo.usage),
                  quota: formatBytes(storageInfo.quota),
                })}
              </span>
            </div>
          )}
          {!storageInfo && (
            <div className="flex items-center gap-1.5 text-xs text-tertiary">
              <HardDrive className="w-3.5 h-3.5" />
              <span>{t('tts.kitten.storageUnknown')}</span>
            </div>
          )}

          {/* Backend selector */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t('tts.kitten.backend.label')}
            </label>
            {(() => {
              const isModelLoaded = KITTEN_TTS_MODELS.some(
                (m) => modelStates[m.key]?.status === 'loaded',
              )
              return (
                <div className="flex items-center gap-2">
                  {['auto', 'wasm', 'webgpu'].map((b) => {
                    const webgpuDisabled = b === 'webgpu' && !hasWebGPU
                    const locked = isModelLoaded
                    const disabled = webgpuDisabled || locked
                    const tooltip = locked
                      ? t('tts.kitten.backendLocked')
                      : webgpuDisabled
                        ? t('tts.kitten.webgpuUnavailable')
                        : undefined
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => !disabled && saveBackend(b)}
                        disabled={disabled}
                        title={tooltip}
                        className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-md transition-colors ${
                          backend === b
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-secondary text-text hover:bg-surface-hover'
                        } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        {t(`tts.kitten.backend.${b}`)}
                      </button>
                    )
                  })}
                </div>
              )
            })()}
            <p className="text-xs text-secondary mt-1">{t('tts.kitten.backend.desc')}</p>
          </div>

          {/* Voice selector */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t('tts.kitten.voice.label')}
            </label>
            <select
              value={kittenVoice}
              onChange={(e) => saveKittenVoice(e.target.value)}
              className="w-full px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface text-text text-sm"
            >
              {KITTEN_TTS_VOICES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <p className="text-xs text-secondary mt-1">{t('tts.kitten.voice.desc')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t('tts.kitten.speed.label')}
            </label>
            <SettingSlider
              value={kittenSpeed}
              onChange={saveKittenSpeed}
              min={0.5}
              max={2}
              step={0.1}
              label={t('tts.kitten.speed.label')}
            />
            <p className="text-xs text-secondary mt-1">{t('tts.kitten.speed.desc')}</p>
          </div>

          {/* Preview button */}
          <button
            type="button"
            onClick={handleKittenPreview}
            disabled={
              (previewPhase === 'loading' || previewPhase === 'idle') &&
              (actionDisabled ||
                activeProvider === 'browser' ||
                modelStates[activeProvider]?.status !== 'loaded')
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-md bg-surface-secondary text-text hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {previewPhase === 'loading' ? (
              <Loader className="w-3.5 h-3.5 animate-spin" />
            ) : previewPhase === 'playing' ? (
              <Square className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
            {previewPhase === 'playing' ? t('chat:stop') : t('tts.kitten.actions.preview')}
          </button>

          {/* Model cards */}
          <div className="space-y-3">
            {KITTEN_TTS_MODELS.map((model) => (
              <KittenModelCard
                key={model.key}
                model={model}
                state={modelStates[model.key]}
                loadedBackend={modelStates[model.key]?.status === 'loaded' ? loadedBackend : null}
                t={t}
                onDownload={() => handleDownload(model.key)}
                onLoad={() => handleLoad(model.key)}
                onUnload={() => handleUnload(model.key)}
                onDelete={() => handleDelete(model.key)}
                disabled={actionDisabled}
              />
            ))}
          </div>
        </div>
      </CollapsibleSection>
    </div>
  )
}

export default TtsSettingsPanel
