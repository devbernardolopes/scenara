const DEFAULT_TIMEOUT_MS = 30000

let worker = null
let idCounter = 0
let debugEnabled = false

const pending = new Map()
const progressListeners = new Set()

export function setDebug(enabled) {
  debugEnabled = !!enabled
}

export function isDebugEnabled() {
  return debugEnabled
}

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('../workers/inference.worker.js', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (event) => handleWorkerMessage(event.data)
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Inference worker crashed')
      pending.forEach((entry) => {
        clearTimeout(entry.timer)
        entry.reject(error)
      })
      pending.clear()
    }
  }
  return worker
}

export function initInferenceWorker() {
  getWorker()
}

function handleWorkerMessage(message) {
  const { id, type, data } = message

  if (type === 'model-loading') {
    progressListeners.forEach((listener) => {
      try {
        listener(data)
      } catch {
        // listener errors must not break the message loop
      }
    })
    return
  }

  if (type === 'debug') {
    if (debugEnabled) {
      // eslint-disable-next-line no-console
      console.debug('[inference:debug]', data)
    }
    return
  }

  const entry = pending.get(id)
  if (!entry) return

  clearTimeout(entry.timer)
  pending.delete(id)

  if (type === 'result') {
    entry.resolve(data)
  } else if (type === 'error') {
    entry.reject(new Error(data))
  }
}

export function run(task, payload, options = {}, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const activeWorker = getWorker()
  const callId = `inf-${++idCounter}-${Date.now()}`
  const modelKey = options?.modelKey ?? task

  const taskOptions = { ...options }
  delete taskOptions.modelKey

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(callId)
      reject(new Error(`Inference task '${task}' timed out after ${timeout}ms`))
    }, timeout)

    pending.set(callId, { resolve, reject, timer })
    activeWorker.postMessage({ id: callId, task, modelKey, payload, options: taskOptions })
  })
}

export function disposeModel(modelKey) {
  return run('disposeModel', {}, { modelKey }, { timeout: 10000 })
}

export function onModelLoading(listener) {
  progressListeners.add(listener)
  return () => progressListeners.delete(listener)
}

// ── TTS helpers ──────────────────────────────────────────────────────────────

export const KITTEN_TTS_MODELS = [
  {
    key: 'kitten-mini',
    labelKey: 'settings:tts.kitten.models.mini.label',
    descKey: 'settings:tts.kitten.models.mini.desc',
    params: '80M',
    approxSize: '80 MB',
  },
  {
    key: 'kitten-micro',
    labelKey: 'settings:tts.kitten.models.micro.label',
    descKey: 'settings:tts.kitten.models.micro.desc',
    params: '40M',
    approxSize: '41 MB',
  },
  {
    key: 'kitten-nano-fp32',
    labelKey: 'settings:tts.kitten.models.nanoFp32.label',
    descKey: 'settings:tts.kitten.models.nanoFp32.desc',
    params: '15M',
    approxSize: '56 MB',
  },
  {
    key: 'kitten-nano-int8',
    labelKey: 'settings:tts.kitten.models.nanoInt8.label',
    descKey: 'settings:tts.kitten.models.nanoInt8.desc',
    params: '15M',
    approxSize: '25 MB',
  },
]

export const KITTEN_TTS_VOICES = [
  'Bella',
  'Jasper',
  'Luna',
  'Bruno',
  'Rosie',
  'Hugo',
  'Kiki',
  'Leo',
]

export function checkTtsCache(modelKey) {
  return run('tts-check-cache', {}, { modelKey }, { timeout: 10000 })
}

export function downloadTtsModel(modelKey) {
  return run('tts-download', {}, { modelKey }, { timeout: 600000 })
}

export function loadTtsModel(modelKey, backend) {
  return run('tts-load', {}, { modelKey, backend }, { timeout: 120000 })
}

export function unloadTtsModel(modelKey) {
  return run('tts-unload', {}, { modelKey }, { timeout: 10000 })
}

export function deleteTtsModel(modelKey) {
  return run('tts-delete', {}, { modelKey }, { timeout: 10000 })
}

export function previewTtsModel(modelKey) {
  return run('tts-preview', {}, { modelKey }, { timeout: 30000 })
}
