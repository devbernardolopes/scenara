import { getSetting } from './settings'
import { startGenerating, stopGenerating } from './generatingState'

let queue = []
let inflight = new Set()
let schedulerRunning = false
let lastDispatchTime = 0
let requestCounter = 0
const listeners = new Set()

function generateId() {
  return `apiq_${++requestCounter}_${Date.now()}`
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
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
    queueLength: queue.length + inflight.size,
    queue: queue.map((item) => ({ id: item.id, threadId: item.threadId, type: item.type })),
    inflight: [...inflight].map((item) => ({
      id: item.id,
      threadId: item.threadId,
      type: item.type,
      director: !!item.directorPhase,
    })),
  }
}

async function scheduleDispatch() {
  if (schedulerRunning) return
  schedulerRunning = true

  try {
    while (queue.length > 0) {
      const cooldownMs = await getCooldownMs()
      const elapsed = Date.now() - lastDispatchTime

      if (elapsed < cooldownMs) {
        await sleep(cooldownMs - elapsed)
      }

      if (queue.length === 0) break

      const item = queue.shift()

      if (item.signal?.aborted) {
        item.reject?.(new DOMException('Aborted before execution', 'AbortError'))
        notify()
        continue
      }

      lastDispatchTime = Date.now()
      dispatch(item)
    }
  } finally {
    schedulerRunning = false
  }
}

function dispatch(item) {
  inflight.add(item)
  startGenerating(item.threadId)
  notify()

  const ctx = {
    markStreaming: () => {
      item.streamingStarted = true
    },
    markActivity: () => {
      item.lastActivityAt = Date.now()
    },
    setDirectorPhase: (active) => {
      item.directorPhase = !!active
      notify()
    },
  }

  let idleIntervalId = null
  let settled = false

  getTimeoutMs().then((timeoutMs) => {
    if (settled) return
    idleIntervalId = setInterval(() => {
      if (item.signal?.aborted) return
      const lastActivity = item.lastActivityAt ?? item.enqueuedAt
      if (Date.now() - lastActivity > timeoutMs) {
        item.controller?.abort()
      }
    }, 1000)
  })

  Promise.resolve()
    .then(() => item.execute(ctx))
    .then((result) => item.resolve?.(result))
    .catch((err) => item.reject?.(err))
    .finally(() => {
      settled = true
      if (idleIntervalId) clearInterval(idleIntervalId)
      inflight.delete(item)
      const tid = item.threadId
      const stillGenerating = [...inflight].some((i) => i.threadId === tid)
      if (!stillGenerating) stopGenerating(tid)
      notify()
    })
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
    enqueuedAt: Date.now(),
    lastActivityAt: null,
  }

  queue.push(item)
  autoRemoveIfAborted(item)
  notify()

  scheduleDispatch()

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

  for (const item of inflight) {
    if (item.id === id) {
      item.controller?.abort()
      return true
    }
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

  for (const item of inflight) {
    if (item.threadId === tid) {
      item.controller?.abort()
      cancelled = true
    }
  }

  if (cancelled) notify()
  return cancelled
}

export function getThreadQueueCount(threadId) {
  const tid = Number(threadId)
  const queued = queue.filter((item) => item.threadId === tid).length
  let running = 0
  for (const item of inflight) {
    if (item.threadId === tid) running += 1
  }
  return queued + running
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export async function waitForCooldown() {
  const cooldownMs = await getCooldownMs()
  const elapsed = Date.now() - lastDispatchTime
  if (elapsed < cooldownMs) {
    await sleep(cooldownMs - elapsed)
  }
}
