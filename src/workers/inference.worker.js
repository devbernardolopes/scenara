import { pipeline, env } from '@huggingface/transformers'
import * as ort from 'onnxruntime-web/webgpu'

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
    webgpu: false,
    idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
  },
  'kitten-micro': {
    repoId: 'KittenML/kitten-tts-micro-0.8',
    modelFile: 'kitten_tts_micro_v0_8.onnx',
    files: ['config.json', 'kitten_tts_micro_v0_8.onnx', 'voices.npz'],
    webgpu: false,
    idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
  },
  'kitten-nano-fp32': {
    repoId: 'KittenML/kitten-tts-nano-0.8-fp32',
    modelFile: 'kitten_tts_nano_v0_8.onnx',
    files: ['config.json', 'kitten_tts_nano_v0_8.onnx', 'voices.npz'],
    webgpu: true,
    idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
  },
  'kitten-nano-int8': {
    repoId: 'KittenML/kitten-tts-nano-0.8-int8',
    modelFile: 'kitten_tts_nano_v0_8.onnx',
    files: ['config.json', 'kitten_tts_nano_v0_8.onnx', 'voices.npz'],
    webgpu: true,
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

const TTS_SAMPLE_RATE = 24000

const KITTEN_VOICE_ALIASES = {
  Bella: 'expr-voice-2-f',
  Jasper: 'expr-voice-2-m',
  Luna: 'expr-voice-3-f',
  Bruno: 'expr-voice-3-m',
  Rosie: 'expr-voice-4-f',
  Hugo: 'expr-voice-4-m',
  Kiki: 'expr-voice-5-f',
  Leo: 'expr-voice-5-m',
}

const KITTEN_SPEED_PRIORS = {
  'expr-voice-2-f': 0.8,
  'expr-voice-2-m': 0.8,
  'expr-voice-3-m': 0.8,
  'expr-voice-3-f': 0.8,
  'expr-voice-4-m': 0.9,
  'expr-voice-4-f': 0.8,
  'expr-voice-5-m': 0.8,
  'expr-voice-5-f': 0.8,
}

// TextCleaner vocabulary — IPA symbol table from KittenTTS
const TC_PAD = '$'
const TC_PUNCTUATION = ';:,.!?¡¿—…"«»"" '
const TC_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const TC_LETTERS_IPA =
  'ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘\u2018̩\u2019ᵻ'
const SYMBOLS = [
  TC_PAD,
  ...Array.from(TC_PUNCTUATION),
  ...Array.from(TC_LETTERS),
  ...Array.from(TC_LETTERS_IPA),
]
const WORD_INDEX = {}
SYMBOLS.forEach((sym, i) => {
  WORD_INDEX[sym] = i
})

const BASIC_ENGLISH_TOKEN_RE = /[\p{L}\p{M}\p{N}\p{Pc}]+|[^\p{L}\p{M}\p{N}\p{Pc}\s]/gu

// ── TTS text preprocessing ──────────────────────────────────────────────────

const ONES = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const SCALE = ['', 'thousand', 'million', 'billion', 'trillion']

function threeDigitsToWords(n) {
  if (n === 0) return ''
  const parts = []
  const hundreds = Math.floor(n / 100)
  const remainder = n % 100
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`)
  if (remainder < 20) {
    if (remainder) parts.push(ONES[remainder])
  } else {
    const tensWord = TENS[Math.floor(remainder / 10)]
    const onesWord = ONES[remainder % 10]
    parts.push(onesWord ? `${tensWord}-${onesWord}` : tensWord)
  }
  return parts.join(' ')
}

function numberToWords(n) {
  if (n === 0) return 'zero'
  if (n < 0) return `negative ${numberToWords(-n)}`
  if (n >= 100 && n <= 9999 && n % 100 === 0 && n % 1000 !== 0) {
    const hundreds = n / 100
    if (hundreds < 20) return `${ONES[hundreds]} hundred`
  }
  const parts = []
  for (let i = 0; i < SCALE.length && n > 0; i++) {
    const chunk = n % 1000
    if (chunk) {
      const chunkWords = threeDigitsToWords(chunk)
      parts.push(SCALE[i] ? `${chunkWords} ${SCALE[i]}`.trim() : chunkWords)
    }
    n = Math.floor(n / 1000)
  }
  return parts.reverse().join(' ')
}

function floatToWords(value) {
  const text = String(value)
  const negative = text.startsWith('-')
  const absText = negative ? text.slice(1) : text
  if (absText.includes('.')) {
    const [intPart, decPart] = absText.split('.')
    const intWords = intPart ? numberToWords(parseInt(intPart)) : 'zero'
    const digitMap = [
      'zero',
      'one',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
      'nine',
    ]
    const decWords = decPart
      .split('')
      .map((d) => digitMap[parseInt(d)])
      .join(' ')
    const result = `${intWords} point ${decWords}`
    return negative ? `negative ${result}` : result
  }
  const result = numberToWords(parseInt(absText))
  return negative ? `negative ${result}` : result
}

const CONTRACTIONS = [
  [/\bcan't\b/gi, 'cannot'],
  [/\bwon't\b/gi, 'will not'],
  [/\bshan't\b/gi, 'shall not'],
  [/\bain't\b/gi, 'is not'],
  [/\blet's\b/gi, 'let us'],
  [/\bit's\b/gi, 'it is'],
  [/\b(\w+)n't\b/gi, '$1 not'],
  [/\b(\w+)'re\b/gi, '$1 are'],
  [/\b(\w+)'ve\b/gi, '$1 have'],
  [/\b(\w+)'ll\b/gi, '$1 will'],
  [/\b(\w+)'d\b/gi, '$1 would'],
  [/\b(\w+)'m\b/gi, '$1 am'],
]

function preprocessTtsText(text) {
  let r = text.trim()
  if (!r) return ''
  r = r.replace(/<[^>]+>/g, ' ')
  r = r.replace(/https?:\/\/\S+|www\.\S+/g, '')
  r = r.replace(/\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi, '')
  for (const [pat, rep] of CONTRACTIONS) r = r.replace(pat, rep)
  r = r.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_, n) => numberToWords(parseInt(n)))
  r = r.replace(/(-?[\d,]+(?:\.\d+)?)\s*%/g, (_, num) => {
    const raw = num.replace(/,/g, '')
    return raw.includes('.')
      ? `${floatToWords(raw)} percent`
      : `${numberToWords(parseInt(raw))} percent`
  })
  r = r.replace(/(?<![a-zA-Z])-?[\d,]+(?:\.\d+)?/g, (m) => {
    const raw = m.replace(/,/g, '')
    try {
      return raw.includes('.') ? floatToWords(raw) : numberToWords(parseInt(raw))
    } catch {
      return m
    }
  })
  r = r.toLowerCase()
  r = r.replace(/\s+/g, ' ').trim()
  return r
}

function ensurePunctuation(text) {
  text = text.trim()
  if (!text) return text
  const last = text[text.length - 1]
  if (!'.!?,;:'.includes(last)) text += ','
  return text
}

function chunkTtsText(text, maxLen = 400) {
  const sentences = text.split(/[.!?]+/)
  const chunks = []
  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue
    if (trimmed.length <= maxLen) {
      chunks.push(ensurePunctuation(trimmed))
    } else {
      const words = trimmed.split(/\s+/)
      let temp = ''
      for (const word of words) {
        if (temp.length + word.length + 1 <= maxLen) {
          temp += (temp ? ' ' : '') + word
        } else {
          if (temp) chunks.push(ensurePunctuation(temp))
          temp = word
        }
      }
      if (temp) chunks.push(ensurePunctuation(temp))
    }
  }
  return chunks
}

function basicEnglishTokenize(text) {
  return text.match(BASIC_ENGLISH_TOKEN_RE) ?? []
}

function textCleaner(phonemes) {
  const ids = []
  for (const ch of phonemes) {
    const idx = WORD_INDEX[ch]
    if (idx !== undefined) ids.push(idx)
  }
  return ids
}

async function phonemizeAndTokenize(text, language = 'en-us') {
  const { phonemize } = await import('phonemizer')
  let cleaned = ensurePunctuation(text.trim())
  const results = await phonemize(cleaned, language)
  const ipa = results
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ')
    .trim()
  const tokens = basicEnglishTokenize(ipa)
  let ids = textCleaner(tokens.join(' '))
  ids.unshift(0)
  ids.push(10)
  ids.push(0)
  return { ipa, ids }
}

// ── NPZ loader ──────────────────────────────────────────────────────────────

function parseNpy(data) {
  const magic = [0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59]
  for (let i = 0; i < magic.length; i++) {
    if (data[i] !== magic[i]) throw new Error('Invalid .npy magic number')
  }
  const major = data[6]
  const minor = data[7]
  let headerLen, headerOffset
  if (major === 1 && minor === 0) {
    headerLen = data[8] | (data[9] << 8)
    headerOffset = 10
  } else if (major === 2 && minor === 0) {
    headerLen = data[8] | (data[9] << 8) | (data[10] << 16) | (data[11] << 24)
    headerOffset = 12
  } else {
    throw new Error(`Unsupported .npy version: ${major}.${minor}`)
  }
  const headerBytes = data.slice(headerOffset, headerOffset + headerLen)
  const header = new TextDecoder('ascii').decode(headerBytes)
  const dtypeMatch = header.match(/'descr':\s*'<(\w+)'/)
  const dtype = dtypeMatch ? dtypeMatch[1] : 'f4'
  const shapeMatch = header.match(/'shape':\s*\(([^)]+)\)/)
  const shape = shapeMatch
    ? shapeMatch[1]
        .split(',')
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n))
    : []
  const dataOffset = headerOffset + headerLen
  const arr = data.slice(dataOffset)
  if (dtype === 'f4') {
    const floatArr = new Float32Array(arr.buffer, arr.byteOffset, arr.byteLength / 4)
    if (shape.length === 2) {
      const numEmb = shape[0]
      const embDim = shape[1]
      const embeddings = []
      for (let i = 0; i < numEmb; i++) {
        embeddings.push(floatArr.slice(i * embDim, (i + 1) * embDim))
      }
      return embeddings
    }
    return [floatArr]
  }
  throw new Error(`Unsupported dtype: ${dtype}`)
}

async function parseZip(data) {
  const view = new DataView(data)
  const files = new Map()
  let eocdOffset = data.byteLength - 22
  while (eocdOffset >= 0) {
    if (view.getUint32(eocdOffset, true) === 0x06054b50) break
    eocdOffset--
  }
  if (eocdOffset < 0) throw new Error('Invalid ZIP: EOCD not found')
  const cdOffset = view.getUint32(eocdOffset + 16, true)
  const numEntries = view.getUint16(eocdOffset + 10, true)
  let offset = cdOffset
  for (let i = 0; i < numEntries; i++) {
    const sig = view.getUint32(offset, true)
    if (sig !== 0x02014b50) throw new Error(`Invalid CD signature at ${offset}`)
    const compressedSize = view.getUint32(offset + 20, true)
    const filenameLen = view.getUint16(offset + 28, true)
    const extraLen = view.getUint16(offset + 30, true)
    const commentLen = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const filenameBytes = new Uint8Array(data, offset + 46, filenameLen)
    const filename = new TextDecoder('utf-8').decode(filenameBytes)
    const localHdr = new DataView(data, localOffset)
    const compression = localHdr.getUint16(8, true)
    const dataOff = localOffset + 30 + localHdr.getUint16(26, true) + localHdr.getUint16(28, true)
    const compressed = new Uint8Array(data, dataOff, compressedSize)
    let fileData
    if (compression === 8) {
      const ds = new DecompressionStream('deflate')
      const writer = ds.writable.getWriter()
      writer.write(compressed)
      writer.close()
      const ab = await new Response(ds.readable).arrayBuffer()
      fileData = new Uint8Array(ab)
    } else if (compression === 0) {
      fileData = compressed
    } else {
      throw new Error(`Unsupported compression: ${compression}`)
    }
    files.set(filename, fileData)
    offset += 46 + filenameLen + extraLen + commentLen
  }
  return files
}

async function loadVoicesFromCache(modelKey) {
  const config = KITTEN_MODEL_REGISTRY[modelKey]
  if (!config) throw new Error(`Unknown TTS model: ${modelKey}`)
  const cache = await caches.open(kittenCacheName(modelKey))
  const voicesUrl = kittenFileUrl(config.repoId, 'voices.npz')
  const resp = await cache.match(voicesUrl)
  if (!resp) throw new Error('voices.npz not found in cache')
  const buf = await resp.arrayBuffer()
  const zipFiles = await parseZip(buf)
  const voices = new Map()
  for (const [filename, data] of zipFiles) {
    if (filename.endsWith('.npy')) {
      const voiceName = filename.replace('.npy', '')
      try {
        voices.set(voiceName, parseNpy(data))
      } catch {
        // skip unparseable voice files
      }
    }
  }
  return voices
}

// ── Audio encoding ──────────────────────────────────────────────────────────

function encodeWav(audio, sampleRate) {
  let maxAbs = 0
  for (let i = 0; i < audio.length; i++) {
    const a = Math.abs(audio[i])
    if (a > maxAbs) maxAbs = a
  }
  if (maxAbs > 1.0 || (maxAbs < 0.01 && maxAbs > 0)) {
    const factor = maxAbs > 0 ? 0.9 / maxAbs : 1.0
    for (let i = 0; i < audio.length; i++) audio[i] *= factor
  }
  const pcm = new Int16Array(audio.length)
  for (let i = 0; i < audio.length; i++) {
    const v = Math.max(-1, Math.min(1, audio[i]))
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff
  }
  const buf = new ArrayBuffer(44 + pcm.length * 2)
  const dv = new DataView(buf)
  const writeStr = (off, s) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  dv.setUint32(4, 36 + pcm.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  dv.setUint32(16, 16, true)
  dv.setUint16(20, 1, true)
  dv.setUint16(22, 1, true)
  dv.setUint32(24, sampleRate, true)
  dv.setUint32(28, sampleRate * 2, true)
  dv.setUint16(32, 2, true)
  dv.setUint16(34, 16, true)
  writeStr(36, 'data')
  dv.setUint32(40, pcm.length * 2, true)
  const pcmBytes = new Uint8Array(buf, 44)
  for (let i = 0; i < pcm.length; i++) {
    pcmBytes[i * 2] = pcm[i] & 0xff
    pcmBytes[i * 2 + 1] = (pcm[i] >> 8) & 0xff
  }
  return buf
}

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

  const useWebgpu = backend === 'webgpu' || (backend === 'auto' && config.webgpu)
  const executionProviders = useWebgpu ? ['webgpu', 'wasm'] : ['wasm']

  let session
  try {
    session = await ort.InferenceSession.create(buffer, { executionProviders })
  } catch (err) {
    if (executionProviders.length > 1) {
      session = await ort.InferenceSession.create(buffer, {
        executionProviders: ['wasm'],
      })
    } else {
      throw err
    }
  }

  kittenSessions.set(modelKey, { session, config, voices: null })
  try {
    const voices = await loadVoicesFromCache(modelKey)
    kittenSessions.get(modelKey).voices = voices
  } catch {
    // voices will remain null — preview will fail gracefully
  }
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

async function previewTtsVoice(modelKey, voiceName, text) {
  const entry = kittenSessions.get(modelKey)
  if (!entry) throw new Error('Model not loaded')
  if (!entry.voices || entry.voices.size === 0) throw new Error('Voices not loaded')

  const displayVoice = voiceName || 'Leo'
  const internalVoice = KITTEN_VOICE_ALIASES[displayVoice] || displayVoice
  const speedPrior = KITTEN_SPEED_PRIORS[internalVoice] ?? 1.0
  const effectiveSpeed = speedPrior

  const inputText = text || 'Hello! This is a preview of the Kitten TTS voice.'
  const chunks = chunkTtsText(preprocessTtsText(inputText))

  const allAudio = []
  for (const chunk of chunks) {
    const { ids } = await phonemizeAndTokenize(chunk)
    const inputIds = new BigInt64Array(ids.map((n) => BigInt(n)))

    const embeddings = entry.voices.get(internalVoice)
    if (!embeddings || embeddings.length === 0) {
      throw new Error(`Voice "${displayVoice}" not found`)
    }
    const refId = Math.min(ids.length, embeddings.length - 1)
    const styleEmbedding = embeddings[refId]

    const feeds = {
      input_ids: new ort.Tensor('int64', inputIds, [1, ids.length]),
      style: new ort.Tensor('float32', styleEmbedding, [1, styleEmbedding.length]),
      speed: new ort.Tensor('float32', new Float32Array([effectiveSpeed]), [1]),
    }

    const results = await entry.session.run(feeds)
    const outputName = entry.session.outputNames[0]
    const outputTensor = results[outputName]
    let audio = new Float32Array(outputTensor.data)
    if (audio.length > 5000) audio = audio.slice(0, audio.length - 5000)
    allAudio.push(audio)
  }

  const totalLen = allAudio.reduce((sum, a) => sum + a.length, 0)
  const merged = new Float32Array(totalLen)
  let offset = 0
  for (const a of allAudio) {
    merged.set(a, offset)
    offset += a.length
  }

  const wavBuf = encodeWav(merged, TTS_SAMPLE_RATE)
  return {
    modelKey,
    audio: wavBuf,
    sampleRate: TTS_SAMPLE_RATE,
    duration: merged.length / TTS_SAMPLE_RATE,
  }
}

const TTS_TASK_HANDLERS = {
  'tts-check-cache': (payload, options, modelKey) => checkTtsCache(modelKey),
  'tts-download': (payload, options, modelKey, callId) => downloadTtsModel(modelKey, callId),
  'tts-load': (payload, options, modelKey, callId) =>
    loadTtsModel(modelKey, callId, options?.backend),
  'tts-unload': (payload, options, modelKey) => unloadKittenModel(modelKey),
  'tts-delete': (payload, options, modelKey) => deleteTtsModel(modelKey),
  'tts-preview': (payload, options, modelKey) =>
    previewTtsVoice(modelKey, options?.voice, options?.text),
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
