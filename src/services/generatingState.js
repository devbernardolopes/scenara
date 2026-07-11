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
