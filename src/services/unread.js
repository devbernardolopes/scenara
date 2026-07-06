import db from '../db'

const broadcastChannel = new BroadcastChannel('scenara-unread')

export function isAwayFromThread(threadId) {
  if (document.visibilityState !== 'visible') return true
  if (!document.hasFocus()) return true

  const path = window.location.pathname
  const chatMatch = path.match(/^\/chat\/(\d+)/)
  if (!chatMatch) return true
  if (Number(chatMatch[1]) !== Number(threadId)) return true

  return false
}

export async function addUnread(threadId) {
  await db.transaction('rw', db.threads, async () => {
    const thread = await db.threads.get(Number(threadId))
    if (!thread) return
    await db.threads.update(Number(threadId), {
      unreadCount: (thread.unreadCount || 0) + 1,
    })
  })
  window.dispatchEvent(new CustomEvent('threads-changed'))
  broadcastChannel.postMessage({ type: 'unread-updated', threadId: Number(threadId) })
}

export async function clearUnread(threadId) {
  await db.threads.update(Number(threadId), { unreadCount: 0 })
  window.dispatchEvent(new CustomEvent('threads-changed'))
  broadcastChannel.postMessage({ type: 'unread-updated', threadId: Number(threadId) })
}

export async function getTotalUnread() {
  const all = await db.threads.toArray()
  return all.reduce((sum, t) => sum + (t.unreadCount || 0), 0)
}

export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.3
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.stop(ctx.currentTime + 0.3)
    osc.onended = () => ctx.close()
  } catch {}
}

export function initBroadcastChannel(onMessage) {
  broadcastChannel.onmessage = (event) => {
    if (event.data?.type === 'unread-updated') {
      onMessage?.(event.data)
      window.dispatchEvent(new CustomEvent('unread-changed', { detail: event.data }))
    }
  }
  return () => {
    broadcastChannel.onmessage = null
  }
}
