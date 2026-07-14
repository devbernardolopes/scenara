const generatingThreads = new Set()

export function getGeneratingThreads() {
  return new Set(generatingThreads)
}

const firstMessageTriggered = new Set()

export function markFirstMessageTriggered(threadId) {
  firstMessageTriggered.add(Number(threadId))
}

export function hasFirstMessageTriggered(threadId) {
  return firstMessageTriggered.has(Number(threadId))
}

const streamingMessageIds = new Map()

export function setStreamingMessageId(threadId, messageId) {
  streamingMessageIds.set(Number(threadId), Number(messageId))
  window.dispatchEvent(
    new CustomEvent('streaming-message-changed', {
      detail: { threadId: Number(threadId), messageId: Number(messageId) },
    }),
  )
}

export function getStreamingMessageId(threadId) {
  const id = streamingMessageIds.get(Number(threadId))
  return id == null ? null : Number(id)
}

export function clearStreamingMessageId(threadId) {
  streamingMessageIds.delete(Number(threadId))
  window.dispatchEvent(
    new CustomEvent('streaming-message-changed', {
      detail: { threadId: Number(threadId), messageId: null },
    }),
  )
}

const streamingSlotIndices = new Map()

export function setStreamingSlotIndex(threadId, slotIndex) {
  streamingSlotIndices.set(Number(threadId), Number(slotIndex))
  window.dispatchEvent(
    new CustomEvent('streaming-slot-index-changed', {
      detail: { threadId: Number(threadId), slotIndex: Number(slotIndex) },
    }),
  )
}

export function getStreamingSlotIndex(threadId) {
  const idx = streamingSlotIndices.get(Number(threadId))
  return idx == null ? null : Number(idx)
}

export function clearStreamingSlotIndex(threadId) {
  streamingSlotIndices.delete(Number(threadId))
  window.dispatchEvent(
    new CustomEvent('streaming-slot-index-changed', {
      detail: { threadId: Number(threadId), slotIndex: null },
    }),
  )
}

const streamingStartTimes = new Map()

export function setStreamingStartTime(messageId, startTime) {
  streamingStartTimes.set(Number(messageId), startTime)
}

export function getStreamingStartTime(messageId) {
  return streamingStartTimes.get(Number(messageId)) || null
}

export function clearStreamingStartTime(messageId) {
  streamingStartTimes.delete(Number(messageId))
}

export function startGenerating(threadId) {
  const id = Number(threadId)
  generatingThreads.add(id)
  window.dispatchEvent(
    new CustomEvent('generating-state-changed', {
      detail: { threadId: id, generating: true },
    }),
  )
}

export function stopGenerating(threadId) {
  const id = Number(threadId)
  generatingThreads.delete(id)
  window.dispatchEvent(
    new CustomEvent('generating-state-changed', {
      detail: { threadId: id, generating: false },
    }),
  )
}
