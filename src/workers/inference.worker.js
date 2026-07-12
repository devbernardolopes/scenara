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

const TASK_HANDLERS = {
  'title-generation': handleTitleGeneration,
}

const pipelineCache = new Map()
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
  const config = MODEL_REGISTRY[modelKey]
  const timeout = config?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS
  const existing = idleTimers.get(modelKey)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    idleTimers.delete(modelKey)
    disposeModel(modelKey)
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
