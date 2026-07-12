import { getSetting } from './settings'
import { startGenerating, stopGenerating } from './generatingState'

let queue = []
let currentRequest = null
let isProcessing = false
let lastRequestEndTime = 0
let requestCounter = 0
const listeners = new Set()

function generateId() {
  return `apiq_${++requestCounter}_${Date.now()}`
}

async function getCooldownMs() {
  const seconds = (await getSetting('api.requestCooldown')) ?? 2
  return seconds * 1000
}

async function getTimeoutMs() {
  const seconds = (await getSetting('api.requestTimeout')) ?? 150
  return seconds * 1000
}

function notify() {
  const state = getState()
  window.dispatchEvent(new CustomEvent('api-queue-changed', { detail: state }))
  listeners.forEach((fn) => {
    try {
      fn(state)
    } catch (e) {
      console.error(e)
    }
  })
}

export function getState() {
  return {
    queueLength: queue.length,
    currentRequestId: currentRequest?.id ?? null,
    currentThreadId: currentRequest?.threadId ?? null,
    currentRequestType: currentRequest?.type ?? null,
    queue: queue.map((item) => ({ id: item.id, threadId: item.threadId, type: item.type })),
  }
}

async function processNext() {
  if (isProcessing) return
  isProcessing = true

  while (queue.length > 0) {
    const now = Date.now()
    const cooldownMs = await getCooldownMs()
    const elapsed = now - lastRequestEndTime

    if (elapsed < cooldownMs) {
      await new Promise((r) => setTimeout(r, cooldownMs - elapsed))
    }

    if (queue.length === 0) break

    const item = queue.shift()

    if (item.signal?.aborted) {
      item.reject?.(new DOMException('Aborted before execution', 'AbortError'))
      notify()
      continue
    }

    currentRequest = item
    startGenerating(item.threadId)
    notify()

    const timeoutMs = await getTimeoutMs()
    const timeoutId = setTimeout(() => {
      if (!item.streamingStarted && !item.signal?.aborted) {
        item.controller?.abort()
      }
    }, timeoutMs)

    try {
      const result = await item.execute()
      item.resolve?.(result)
    } catch (err) {
      item.reject?.(err)
    } finally {
      clearTimeout(timeoutId)
      lastRequestEndTime = Date.now()
      const tid = item.threadId
      currentRequest = null
      stopGenerating(tid)
      notify()
    }
  }

  isProcessing = false
  notify()
}

function autoRemoveIfAborted(item) {
  if (!item.signal) return
  if (item.signal.aborted) {
    const idx = queue.indexOf(item)
    if (idx !== -1) {
      queue.splice(idx, 1)
      notify()
    }
    return
  }
  item.signal.addEventListener(
    'abort',
    () => {
      const idx = queue.indexOf(item)
      if (idx !== -1) {
        queue.splice(idx, 1)
        notify()
      }
    },
    { once: true },
  )
}

export function enqueue({ threadId, type, execute, signal, controller }) {
  let resolve, reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })

  const id = generateId()
  const item = {
    id,
    threadId: Number(threadId),
    type,
    execute,
    signal,
    controller,
    resolve,
    reject,
    streamingStarted: false,
  }

  queue.push(item)
  autoRemoveIfAborted(item)
  notify()

  processNext()

  return { id, promise }
}

export function cancelRequest(id) {
  const idx = queue.findIndex((item) => item.id === id)
  if (idx !== -1) {
    const [item] = queue.splice(idx, 1)
    item.reject?.(new DOMException('Cancelled', 'AbortError'))
    notify()
    return true
  }

  if (currentRequest?.id === id) {
    currentRequest.controller?.abort()
    return true
  }

  return false
}

export function cancelThreadRequests(threadId) {
  const tid = Number(threadId)
  let cancelled = false

  queue = queue.filter((item) => {
    if (item.threadId === tid) {
      item.reject?.(new DOMException('Cancelled', 'AbortError'))
      cancelled = true
      return false
    }
    return true
  })

  if (currentRequest?.threadId === tid) {
    currentRequest.controller?.abort()
    cancelled = true
  }

  if (cancelled) notify()
  return cancelled
}

export function getThreadQueueCount(threadId) {
  const tid = Number(threadId)
  return queue.filter((item) => item.threadId === tid).length
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function markCurrentRequestStreaming() {
  if (currentRequest) {
    currentRequest.streamingStarted = true
  }
}

export async function waitForCooldown() {
  const cooldownMs = await getCooldownMs()
  const elapsed = Date.now() - lastRequestEndTime
  if (elapsed < cooldownMs) {
    await new Promise((r) => setTimeout(r, cooldownMs - elapsed))
  }
}
