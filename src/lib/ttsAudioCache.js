// In-memory cache of synthesized TTS chunks.
//
// Progressive playback synthesizes a message one chunk at a time; caching the
// resulting `{ pcm, sampleRate }` payloads means replays (and re-renders) are
// instant instead of re-running inference. Bounded with a simple LRU eviction.
//
// Entries are keyed by the spoken text, not by message id or slot index: a
// message bubble can hold several regenerated/edited slots, and slots renumber
// when deleted, so only the content itself identifies what was synthesized.

const MAX_ENTRIES = 48

const cache = new Map()

// FNV-1a 32-bit, base36. Stable for identical text, cheap on every utterance.
export function hashTtsText(text) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export function ttsChunkKey(modelKey, voice, speed, textHash, index) {
  return `${modelKey}|${voice}|${speed}|${textHash}|${index}`
}

export function getTtsChunk(key) {
  if (!cache.has(key)) return null
  const value = cache.get(key)
  // refresh recency
  cache.delete(key)
  cache.set(key, value)
  return value
}

export function setTtsChunk(key, chunk) {
  if (!chunk) return
  cache.set(key, chunk)
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    cache.delete(oldest)
  }
}
