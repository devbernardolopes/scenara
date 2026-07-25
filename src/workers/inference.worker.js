import { pipeline, env } from '@huggingface/transformers'

env.allowLocalModels = false

const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000

const TITLE_PROMPT_TEMPLATE =
  'Summarize the topic of this conversation in a short title of 8 words or fewer. ' +
  'Do not include character names, the word "chat", or any speaker labels. ' +
  'Conversation: {{transcript}}'

const MAX_TITLE_WORDS = 10

const MODEL_REGISTRY = {
  'title-generation': {
    task: 'text2text-generation',
    modelId: 'Xenova/flan-t5-small',
    dtype: 'q8',
    promptTemplate: TITLE_PROMPT_TEMPLATE,
    generationOptions: {
      max_new_tokens: 16,
      repetition_penalty: 1.3,
      no_repeat_ngram_size: 3,
    },
    idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
  },
  'title-generation-distilbart': {
    task: 'summarization',
    modelId: 'Xenova/distilbart-xsum-12-6',
    // modelId: 'Xenova/distilbart-xsum-1-1-3',
    dtype: 'q8',
    promptTemplate: TITLE_PROMPT_TEMPLATE,
    generationOptions: {
      max_new_tokens: 32,
      repetition_penalty: 1.2,
      no_repeat_ngram_size: 3,
    },
    idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
  },
}

const KITTEN_MODEL_REGISTRY = {
  'kitten-mini': {
    repoId: 'KittenML/kitten-tts-mini-0.8',
    modelFile: 'kitten_tts_mini_v0_8.onnx',
    files: ['config.json', 'kitten_tts_mini_v0_8.onnx', 'voices.npz'],
    idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
  },
  'kitten-micro': {
    repoId: 'KittenML/kitten-tts-micro-0.8',
    modelFile: 'kitten_tts_micro_v0_8.onnx',
    files: ['config.json', 'kitten_tts_micro_v0_8.onnx', 'voices.npz'],
    idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
  },
  'kitten-nano-fp32': {
    repoId: 'KittenML/kitten-tts-nano-0.8-fp32',
    modelFile: 'kitten_tts_nano_v0_8.onnx',
    files: ['config.json', 'kitten_tts_nano_v0_8.onnx', 'voices.npz'],
    idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
  },
  'kitten-nano-int8': {
    repoId: 'KittenML/kitten-tts-nano-0.8-int8',
    modelFile: 'kitten_tts_nano_v0_8.onnx',
    files: ['config.json', 'kitten_tts_nano_v0_8.onnx', 'voices.npz'],
    idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
  },
}

const TASK_HANDLERS = {
  'title-generation': handleTitleGeneration,
}

const pipelineCache = new Map()
const kittenSessions = new Map()
const idleTimers = new Map()

let webgpuSupport = null
function detectWebGPU() {
  if (webgpuSupport !== null) return webgpuSupport
  try {
    webgpuSupport = typeof navigator !== 'undefined' && !!navigator.gpu
  } catch {
    webgpuSupport = false
  }
  return webgpuSupport
}

function makeProgressCallback(modelKey, callId) {
  return (data) => {
    self.postMessage({
      id: callId,
      type: 'model-loading',
      data: {
        modelKey,
        status: data.status,
        file: data.file,
        name: data.name,
        progress: data.progress,
        loaded: data.loaded,
        total: data.total,
      },
    })
  }
}

function stripSpeakerPrefixes(text) {
  if (!text) return ''
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*[^:[\]()\n]{1,40}\s*:\s*/, ''))
    .join('\n')
}

async function createPipeline(modelKey, callId) {
  const config = MODEL_REGISTRY[modelKey]
  const modelId = config.modelId
  const dtype = config.dtype

  const buildOpts = (device) => ({
    dtype,
    device,
    progress_callback: makeProgressCallback(modelKey, callId),
  })

  const preferWebGPU = detectWebGPU()
  if (preferWebGPU) {
    try {
      return await pipeline(config.task, modelId, buildOpts('webgpu'))
    } catch {
      // Hardware may report WebGPU but fail on actual device request.
    }
  }
  return await pipeline(config.task, modelId, buildOpts('wasm'))
}

async function getPipeline(modelKey, callId) {
  if (pipelineCache.has(modelKey)) {
    return await pipelineCache.get(modelKey)
  }
  const promise = createPipeline(modelKey, callId)
  pipelineCache.set(modelKey, promise)
  try {
    return await promise
  } catch (err) {
    pipelineCache.delete(modelKey)
    throw err
  }
}

async function disposeModel(modelKey) {
  if (kittenSessions.has(modelKey)) {
    await unloadKittenModel(modelKey)
    return true
  }
  const timer = idleTimers.get(modelKey)
  if (timer) {
    clearTimeout(timer)
    idleTimers.delete(modelKey)
  }
  const entry = pipelineCache.get(modelKey)
  if (!entry) return false
  pipelineCache.delete(modelKey)
  try {
    const pipe = await entry
    if (pipe && typeof pipe.dispose === 'function') {
      await pipe.dispose()
    }
  } catch {
    // ignore disposal errors
  }
  return true
}

function scheduleIdleUnload(modelKey) {
  const config = MODEL_REGISTRY[modelKey] || KITTEN_MODEL_REGISTRY[modelKey]
  const timeout = config?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS
  const existing = idleTimers.get(modelKey)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    idleTimers.delete(modelKey)
    if (kittenSessions.has(modelKey)) {
      unloadKittenModel(modelKey)
    } else {
      disposeModel(modelKey)
    }
  }, timeout)
  idleTimers.set(modelKey, timer)
}

function emitDebug({ id, task, modelKey, prompt, rawOutput, postProcessedOutput }) {
  self.postMessage({
    type: 'debug',
    data: {
      taskId: id,
      task,
      modelKey,
      prompt,
      rawOutput,
      postProcessedOutput,
    },
  })
}

function postProcessTitle(text) {
  if (!text || typeof text !== 'string') return ''
  let result = text.trim()
  const words = result.split(/\s+/).filter(Boolean)
  if (words.length > MAX_TITLE_WORDS) {
    result = words.slice(0, MAX_TITLE_WORDS).join(' ')
  }
  result = result.replace(/[\s"'`,.!?;:]+$/u, '').trim()
  return result
}

function extractGeneratedText(output) {
  if (Array.isArray(output) && output.length > 0) {
    const item = output[0]
    return item?.generated_text ?? item?.summary_text ?? ''
  }
  if (output && typeof output === 'object') {
    return output.generated_text ?? output.summary_text ?? ''
  }
  return typeof output === 'string' ? output : ''
}

async function handleTitleGeneration(pipe, payload, options, modelKey) {
  const config = MODEL_REGISTRY[modelKey]
  const content = stripSpeakerPrefixes((payload?.text || '').toString()).slice(0, 1500)
  const prompt = (config.promptTemplate || TITLE_PROMPT_TEMPLATE).replace('{{transcript}}', content)

  const registryGen = config.generationOptions || {}
  const requestGen = options?.generationOptions || {}
  const generationOptions = { ...registryGen, ...requestGen }

  const output = await pipe(prompt, generationOptions)
  const rawOutput = extractGeneratedText(output)
  const postProcessedOutput = postProcessTitle(rawOutput)
  return { prompt, rawOutput, postProcessedOutput }
}

// ── Kitten TTS ───────────────────────────────────────────────────────────────

function kittenCacheName(modelKey) {
  return `kitten-tts-${modelKey}`
}

function kittenFileUrl(repoId, file) {
  return `https://huggingface.co/${repoId}/resolve/main/${file}`
}

async function checkTtsCache(modelKey) {
  const config = KITTEN_MODEL_REGISTRY[modelKey]
  if (!config) throw new Error(`Unknown TTS model: ${modelKey}`)
  const cache = await caches.open(kittenCacheName(modelKey))
  const keys = await cache.keys()
  const cached = keys.length >= config.files.length
  let storageInfo = null
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate()
      storageInfo = { usage: est.usage, quota: est.quota }
    }
  } catch {
    // storage estimate not available
  }
  return {
    modelKey,
    cached,
    fileCount: keys.length,
    expectedFiles: config.files.length,
    storageInfo,
  }
}

async function downloadTtsModel(modelKey, callId) {
  const config = KITTEN_MODEL_REGISTRY[modelKey]
  if (!config) throw new Error(`Unknown TTS model: ${modelKey}`)
  const cache = await caches.open(kittenCacheName(modelKey))
  const progressCb = makeProgressCallback(modelKey, callId)

  let totalBytes = 0
  const fileInfos = []
  for (const file of config.files) {
    const url = kittenFileUrl(config.repoId, file)
    try {
      const headResp = await fetch(url, { method: 'HEAD' })
      const size = parseInt(headResp.headers.get('content-length') || '0', 10)
      fileInfos.push({ file, url, size })
      totalBytes += size
    } catch {
      fileInfos.push({ file, url, size: 0 })
    }
  }

  let loadedBytes = 0
  for (const { file, url, size } of fileInfos) {
    const existing = await cache.match(url)
    if (existing) {
      loadedBytes += size
      progressCb({
        status: 'progress',
        file,
        name: file,
        progress: totalBytes > 0 ? loadedBytes / totalBytes : 0,
        loaded: loadedBytes,
        total: totalBytes,
      })
      continue
    }

    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to download ${file}: ${response.status}`)
    const arrayBuffer = await response.arrayBuffer()
    loadedBytes += arrayBuffer.byteLength
    await cache.put(
      url,
      new Response(arrayBuffer, {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      }),
    )
    progressCb({
      status: 'progress',
      file,
      name: file,
      progress: totalBytes > 0 ? loadedBytes / totalBytes : 0,
      loaded: loadedBytes,
      total: totalBytes,
    })
  }

  try {
    if (navigator.storage?.persist) await navigator.storage.persist()
  } catch {
    // persistence request denied
  }

  progressCb({
    status: 'done',
    file: '',
    name: '',
    progress: 1,
    loaded: totalBytes,
    total: totalBytes,
  })
  return { modelKey, success: true }
}

async function loadTtsModel(modelKey, callId, backend) {
  const config = KITTEN_MODEL_REGISTRY[modelKey]
  if (!config) throw new Error(`Unknown TTS model: ${modelKey}`)
  if (kittenSessions.has(modelKey)) {
    scheduleIdleUnload(modelKey)
    return { modelKey, success: true, alreadyLoaded: true }
  }

  const cache = await caches.open(kittenCacheName(modelKey))
  const onnxUrl = kittenFileUrl(config.repoId, config.modelFile)
  const response = await cache.match(onnxUrl)
  if (!response) throw new Error('Model file not found in cache. Download it first.')
  const buffer = await response.arrayBuffer()

  const executionProviders =
    backend === 'webgpu' ? ['webgpu'] : backend === 'wasm' ? ['wasm'] : ['webgpu', 'wasm']

  let session
  try {
    session = await env.backends.onnx.InferenceSession.create(buffer, { executionProviders })
  } catch (err) {
    if (executionProviders.length > 1) {
      session = await env.backends.onnx.InferenceSession.create(buffer, {
        executionProviders: ['wasm'],
      })
    } else {
      throw err
    }
  }

  kittenSessions.set(modelKey, { session, config })
  scheduleIdleUnload(modelKey)
  return { modelKey, success: true }
}

async function unloadKittenModel(modelKey) {
  const entry = kittenSessions.get(modelKey)
  if (!entry) return { modelKey, success: true, alreadyUnloaded: true }
  kittenSessions.delete(modelKey)
  const timer = idleTimers.get(modelKey)
  if (timer) {
    clearTimeout(timer)
    idleTimers.delete(modelKey)
  }
  try {
    if (entry.session?.release) await entry.session.release()
    else if (entry.session?.dispose) await entry.session.dispose()
  } catch {
    // ignore disposal errors
  }
  return { modelKey, success: true }
}

async function deleteTtsModel(modelKey) {
  await unloadKittenModel(modelKey)
  const deleted = await caches.delete(kittenCacheName(modelKey))
  return { modelKey, success: deleted }
}

// TODO: implement actual synthesis (phonemize → ONNX inference → audio output)
async function previewTtsVoice(modelKey) {
  if (!kittenSessions.has(modelKey)) throw new Error('Model not loaded')
  return { modelKey, success: true, preview: false }
}

const TTS_TASK_HANDLERS = {
  'tts-check-cache': (payload, options, modelKey) => checkTtsCache(modelKey),
  'tts-download': (payload, options, modelKey, callId) => downloadTtsModel(modelKey, callId),
  'tts-load': (payload, options, modelKey, callId) =>
    loadTtsModel(modelKey, callId, options?.backend),
  'tts-unload': (payload, options, modelKey) => unloadKittenModel(modelKey),
  'tts-delete': (payload, options, modelKey) => deleteTtsModel(modelKey),
  'tts-preview': (payload, options, modelKey) => previewTtsVoice(modelKey),
}

// ── Message dispatch ─────────────────────────────────────────────────────────

async function handleMessage(message) {
  const { id, task, modelKey = task, payload, options } = message

  if (task === 'disposeModel') {
    const disposed = await disposeModel(modelKey)
    self.postMessage({ id, type: 'result', data: { disposed, modelKey } })
    return
  }

  const ttsHandler = TTS_TASK_HANDLERS[task]
  if (ttsHandler) {
    const result = await ttsHandler(payload, options, modelKey, id)
    self.postMessage({ id, type: 'result', data: result })
    return
  }

  const handler = TASK_HANDLERS[task]
  if (!handler) {
    throw new Error(`Unknown inference task: ${task}`)
  }

  const pipe = await getPipeline(modelKey, id)
  const { prompt, rawOutput, postProcessedOutput } = await handler(pipe, payload, options, modelKey)

  emitDebug({ id, task, modelKey, prompt, rawOutput, postProcessedOutput })
  scheduleIdleUnload(modelKey)
  self.postMessage({ id, type: 'result', data: postProcessedOutput })
}

self.onmessage = async (event) => {
  const message = event.data
  const { id } = message
  try {
    await handleMessage(message)
  } catch (err) {
    self.postMessage({
      id,
      type: 'error',
      data: err?.message || String(err),
    })
  }
}
