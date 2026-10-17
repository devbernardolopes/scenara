// In-memory cache of synthesized TTS audio chunks.
//
// Progressive playback synthesizes a message one chunk at a time; caching the
// resulting WAV buffers means replays (and re-renders) are instant instead of
// re-running inference. Bounded with a simple LRU eviction.

const MAX_ENTRIES = 48

const cache = new Map()

export function ttsChunkKey(modelKey, voice, speed, messageId, index) {
  return `${modelKey}|${voice}|${speed}|${messageId}|${index}`
}

export function getTtsChunk(key) {
  if (!cache.has(key)) return null
  const value = cache.get(key)
  // refresh recency
  cache.delete(key)
  cache.set(key, value)
  return value
}

export function setTtsChunk(key, audioBuffer) {
  if (!audioBuffer) return
  cache.set(key, audioBuffer)
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    cache.delete(oldest)
  }
}
