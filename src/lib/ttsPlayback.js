import { getSetting } from '../services/settings'
import { planTts, synthTtsChunk, ensureTtsModelLoaded, cancelTtsTask } from './inferenceClient'
import { getTtsChunk, setTtsChunk, ttsChunkKey } from './ttsAudioCache'
import { prepareTtsText } from './ttsText'
import { showToast } from './toast'

let state = { speakingMessageId: null, phase: 'idle' }
const listeners = new Set()
let audioContext = null
const activeSources = new Set()
let currentUtterances = []
let activeMessageId = null
let currentPlayResolve = null

// Fallback only — the worker reports the true sample rate with each chunk.
const FALLBACK_SAMPLE_RATE = 24000

function emit() {
  listeners.forEach((fn) => {
    try {
      fn(state)
    } catch {
      // listener errors must not break
    }
  })
}

function setState(patch) {
  state = { ...state, ...patch }
  emit()
}

function resetState() {
  currentUtterances = []
  activeMessageId = null
  setState({ speakingMessageId: null, phase: 'idle' })
}

export async function speak(messageId, message, context) {
  if (state.speakingMessageId === messageId) {
    stop()
    return
  }
  stop()

  const text = prepareTtsText(message, context)
  if (!text.trim()) return

  const provider = await getSetting('tts.provider')
  if (provider === 'browser') {
    const voiceName = await getSetting('tts.browserVoice')
    const rate = await getSetting('tts.browserRate')
    const pitch = await getSetting('tts.browserPitch')
    const volume = await getSetting('tts.browserVolume')
    speakBrowser(messageId, text, voiceName, rate, pitch, volume)
  } else {
    const voice = await getSetting('tts.kittenVoice')
    const speed = await getSetting('tts.kittenSpeed')
    const backend = await getSetting('tts.backend')
    const keepLoaded = await getSetting('tts.kittenKeepModel')
    speakKitten(messageId, text, provider, voice, speed, backend, keepLoaded)
  }
}

export function stop() {
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.cancel()
  }
  currentUtterances = []

  for (const source of activeSources) {
    try {
      source.stop()
    } catch {
      // already stopped
    }
  }
  activeSources.clear()
  if (currentPlayResolve) {
    const resolve = currentPlayResolve
    currentPlayResolve = null
    resolve()
  }
  cancelTtsTask().catch(() => {})

  resetState()
}

export function isSpeaking(messageId) {
  return state.speakingMessageId === messageId
}

export function getPlaybackState() {
  return state
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function speakBrowser(messageId, text, voiceName, rate, pitch, volume) {
  const myId = messageId
  activeMessageId = myId
  setState({ speakingMessageId: myId, phase: 'playing' })

  const chunks = chunkForBrowserTts(text)
  let index = 0

  function advance() {
    if (activeMessageId !== myId) return
    if (index >= chunks.length) {
      if (activeMessageId === myId) resetState()
      return
    }

    const chunk = chunks[index++]
    const utterance = new SpeechSynthesisUtterance(chunk)
    currentUtterances.push(utterance)

    if (rate != null) utterance.rate = rate
    if (pitch != null) utterance.pitch = pitch
    if (volume != null) utterance.volume = volume

    if (voiceName) {
      const voices = speechSynthesis.getVoices()
      const match = voices.find((v) => v.name === voiceName)
      if (match) utterance.voice = match
    }

    utterance.onend = () => {
      currentUtterances = currentUtterances.filter((u) => u !== utterance)
      advance()
    }

    utterance.onerror = (e) => {
      currentUtterances = currentUtterances.filter((u) => u !== utterance)
      if (e.error === 'canceled' || e.error === 'interrupted') return
      advance()
    }

    speechSynthesis.speak(utterance)
  }

  advance()
}

function chunkForBrowserTts(text, maxLen = 200) {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const chunks = []
  let buf = ''
  for (const sentence of sentences) {
    if (buf.length + sentence.length + 1 > maxLen && buf) {
      chunks.push(buf.trim())
      buf = ''
    }
    buf += (buf ? ' ' : '') + sentence
  }
  if (buf.trim()) chunks.push(buf.trim())
  return chunks.length ? chunks : [text]
}

function getAudioContext() {
  if (!audioContext || audioContext.state === 'closed') {
    const Ctor = window.AudioContext || window.webkitAudioContext
    audioContext = new Ctor()
  }
  return audioContext
}

function toAudioBuffer(ctx, pcm, sampleRate) {
  const buffer = ctx.createBuffer(1, pcm.length, sampleRate)
  buffer.copyToChannel(pcm, 0)
  return buffer
}

const TTS_PREFETCH = 3

async function speakKitten(messageId, text, modelKey, voice, speed, backend, keepLoaded) {
  const myId = messageId
  activeMessageId = myId
  setState({ speakingMessageId: myId, phase: 'loading' })

  const voiceName = voice || 'Leo'
  const ensureLoaded = () => ensureTtsModelLoaded(modelKey, backend || 'auto', !!keepLoaded)

  try {
    // Lazily (re)load the session: it may have been idle-unloaded since the last
    // utterance, and the user should never have to reload it by hand.
    await ensureLoaded()
    if (activeMessageId !== myId) return

    const { chunks } = await planTts(text)
    if (activeMessageId !== myId) return
    if (!chunks || chunks.length === 0) {
      resetState()
      return
    }

    const loadChunk = async (index) => {
      const key = ttsChunkKey(modelKey, voiceName, speed, myId, index)
      const cached = getTtsChunk(key)
      if (cached) return cached
      try {
        const result = await synthTtsChunk(modelKey, chunks[index], voiceName, speed)
        setTtsChunk(key, result)
        return result
      } catch (err) {
        if (!/not loaded/i.test(err?.message || '')) throw err
        // The session was idle-unloaded mid-utterance — reload and retry once.
        await ensureLoaded()
        const result = await synthTtsChunk(modelKey, chunks[index], voiceName, speed)
        setTtsChunk(key, result)
        return result
      }
    }

    const ctx = getAudioContext()
    try {
      if (ctx.state === 'suspended') await ctx.resume()
    } catch {
      // the state guard below reports it
    }
    if (activeMessageId !== myId) return
    if (ctx.state !== 'running') {
      throw new Error('Audio playback is blocked until you interact with the page.')
    }

    // Decode each chunk into an AudioBuffer and schedule it on a single timeline
    // so playback is gapless — no per-chunk player startup latency.
    let nextStartTime = 0
    let lastDone = Promise.resolve()

    const scheduleChunk = (result) => {
      if (!result?.pcm || result.pcm.length === 0) return
      const buffer = toAudioBuffer(ctx, result.pcm, result.sampleRate || FALLBACK_SAMPLE_RATE)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      const startAt = Math.max(nextStartTime, ctx.currentTime)
      source.start(startAt)
      nextStartTime = startAt + buffer.duration
      activeSources.add(source)
      if (state.phase !== 'playing') setState({ phase: 'playing' })

      lastDone = new Promise((resolve) => {
        const finish = () => {
          activeSources.delete(source)
          if (currentPlayResolve === finish) currentPlayResolve = null
          resolve()
        }
        currentPlayResolve = finish
        source.onended = finish
      })
    }

    // Keep a small window of synthesis in flight so the next chunk is ready well
    // before the current one finishes playing.
    const pending = new Array(chunks.length)
    const track = (promise) => {
      // Swallow late rejections so a cancelled prefetch can't surface as an
      // unhandled rejection; awaiting the same promise still throws.
      promise.catch(() => {})
      return promise
    }
    for (let i = 0; i < Math.min(TTS_PREFETCH, chunks.length); i++) {
      pending[i] = track(loadChunk(i))
    }

    for (let i = 0; i < chunks.length; i++) {
      const result = await pending[i]
      if (activeMessageId !== myId) return

      const nextIndex = i + TTS_PREFETCH
      if (nextIndex < chunks.length) {
        pending[nextIndex] = track(loadChunk(nextIndex))
      }

      scheduleChunk(result)
    }

    await lastDone
    if (activeMessageId === myId) resetState()
  } catch (err) {
    if (err?.message === 'Cancelled' || activeMessageId !== myId) {
      if (activeMessageId === myId) resetState()
      return
    }
    console.error('[TTS] Kitten synthesis error:', err)
    showToast(err?.message || 'Speech synthesis failed.', { type: 'error' })
    if (activeMessageId === myId) resetState()
  }
}
