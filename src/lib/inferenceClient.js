const DEFAULT_TIMEOUT_MS = 30000

let worker = null
let idCounter = 0

const pending = new Map()
const progressListeners = new Set()

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
