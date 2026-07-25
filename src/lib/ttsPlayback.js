import { getSetting } from '../services/settings'
import { speakTts, cancelTtsTask } from './inferenceClient'
import { prepareTtsText } from './ttsText'
import { showToast } from './toast'

let state = { speakingMessageId: null, phase: 'idle' }
const listeners = new Set()
let currentAudio = null
let currentUtterances = []
let activeMessageId = null

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
    speakBrowser(messageId, text, voiceName)
  } else {
    const voice = await getSetting('tts.kittenVoice')
    const backend = await getSetting('tts.backend')
    speakKitten(messageId, text, provider, voice, backend)
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

function speakBrowser(messageId, text, voiceName) {
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

async function speakKitten(messageId, text, modelKey, voice, backend) {
  const myId = messageId
  activeMessageId = myId
  setState({ speakingMessageId: myId, phase: 'loading' })

  try {
    const result = await speakTts(modelKey, text, voice || 'Leo', backend || 'auto')

    if (activeMessageId !== myId) return

    const blob = new Blob([result.audio], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    currentAudio = audio

    setState({ phase: 'playing' })

    audio.onended = () => {
      URL.revokeObjectURL(url)
      if (currentAudio === audio) currentAudio = null
      if (activeMessageId === myId) resetState()
    }

    audio.onerror = () => {
      URL.revokeObjectURL(url)
      if (currentAudio === audio) currentAudio = null
      if (activeMessageId === myId) resetState()
    }

    await audio.play()
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
