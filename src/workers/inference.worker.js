import { pipeline, env } from '@huggingface/transformers'

env.allowLocalModels = false

const TITLE_PROMPT_TEMPLATE =
  'Generate a short, concise title (maximum 8 words) for this conversation: {content}'

const MAX_TITLE_WORDS = 10

const MODEL_REGISTRY = {
  'title-generation': {
    task: 'text2text-generation',
    modelId: 'Xenova/flan-t5-small',
    dtype: 'q8',
  },
}

const TASK_HANDLERS = {
  'title-generation': handleTitleGeneration,
}

const pipelineCache = new Map()

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

async function handleTitleGeneration(pipe, payload, options) {
  const content = (payload?.text || '').toString().slice(0, 1500)
  const prompt = TITLE_PROMPT_TEMPLATE.replace('{content}', content)
  const output = await pipe(prompt, {
    max_new_tokens: options?.maxNewTokens ?? 20,
    do_sample: false,
    ...options,
  })
  const raw =
    Array.isArray(output) && output.length > 0
      ? (output[0]?.generated_text ?? '')
      : (output?.generated_text ?? '')
  return postProcessTitle(raw)
}

async function handleMessage(message) {
  const { id, task, modelKey = task, payload, options } = message

  if (task === 'disposeModel') {
    const disposed = await disposeModel(modelKey)
    self.postMessage({ id, type: 'result', data: { disposed, modelKey } })
    return
  }

  const handler = TASK_HANDLERS[task]
  if (!handler) {
    throw new Error(`Unknown inference task: ${task}`)
  }

  const pipe = await getPipeline(modelKey, id)
  const result = await handler(pipe, payload, options)
  self.postMessage({ id, type: 'result', data: result })
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
