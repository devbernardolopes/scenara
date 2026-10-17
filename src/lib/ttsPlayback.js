import { getSetting } from '../services/settings'
import { planTts, synthTtsChunk, cancelTtsTask } from './inferenceClient'
import { getTtsChunk, setTtsChunk, ttsChunkKey } from './ttsAudioCache'
import { prepareTtsText } from './ttsText'
import { showToast } from './toast'

let state = { speakingMessageId: null, phase: 'idle' }
const listeners = new Set()
let currentAudio = null
let currentUtterances = []
let activeMessageId = null
let currentPlayResolve = null

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
    speakKitten(messageId, text, provider, voice, speed)
  }
}

export function stop() {
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.cancel()
  }
  currentUtterances = []

  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
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

function playWavBuffer(buffer) {
  return new Promise((resolve) => {
    const blob = new Blob([buffer], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    currentAudio = audio

    const finish = () => {
      URL.revokeObjectURL(url)
      if (currentAudio === audio) currentAudio = null
      if (currentPlayResolve === finish) currentPlayResolve = null
      resolve()
    }

    currentPlayResolve = finish
    audio.onended = finish
    audio.onerror = finish
    const playPromise = audio.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(finish)
    }
  })
}

async function getOrSynthChunk(modelKey, chunk, voice, speed, messageId, index) {
  const key = ttsChunkKey(modelKey, voice, speed, messageId, index)
  const cached = getTtsChunk(key)
  if (cached) return cached
  const result = await synthTtsChunk(modelKey, chunk, voice, speed)
  setTtsChunk(key, result.audio)
  return result.audio
}

async function speakKitten(messageId, text, modelKey, voice, speed) {
  const myId = messageId
  activeMessageId = myId
  setState({ speakingMessageId: myId, phase: 'loading' })

  const voiceName = voice || 'Leo'

  try {
    const { chunks } = await planTts(text)
    if (activeMessageId !== myId) return
    if (!chunks || chunks.length === 0) {
      resetState()
      return
    }

    // Kick off synthesis of the first chunk, then keep one chunk ahead while
    // the current one plays so playback stays gapless.
    let nextAudio = getOrSynthChunk(modelKey, chunks[0], voiceName, speed, myId, 0)

    for (let i = 0; i < chunks.length; i++) {
      const audio = await nextAudio
      if (activeMessageId !== myId) return

      if (i + 1 < chunks.length) {
        nextAudio = getOrSynthChunk(modelKey, chunks[i + 1], voiceName, speed, myId, i + 1)
      }

      if (!audio) continue

      setState({ phase: 'playing' })
      await playWavBuffer(audio)
      if (activeMessageId !== myId) return
    }

    if (activeMessageId === myId) resetState()
  } catch (err) {
    if (err?.message === 'Cancelled' || activeMessageId !== myId) {
      if (activeMessageId === myId) resetState()
      return
    }
    console.error('[TTS] Kitten synthesis error:', err)
    showToast('Speech synthesis failed.', { type: 'error' })
    if (activeMessageId === myId) resetState()
  }
}
