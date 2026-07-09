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

export async function addUnread(threadId, messageId) {
  await db.transaction('rw', db.threads, db.messages, async () => {
    const thread = await db.threads.get(Number(threadId))
    if (!thread) return
    await db.threads.update(Number(threadId), {
      unreadCount: (thread.unreadCount || 0) + 1,
    })
    if (messageId) {
      await db.messages.update(Number(messageId), { isUnread: true })
    }
  })
  window.dispatchEvent(new CustomEvent('threads-changed'))
  broadcastChannel.postMessage({ type: 'unread-updated', threadId: Number(threadId) })
}

export async function markMessageRead(messageId, threadId) {
  await db.transaction('rw', db.messages, db.threads, async () => {
    const msg = await db.messages.get(Number(messageId))
    if (!msg || !msg.isUnread || msg.threadId !== Number(threadId)) return
    await db.messages.update(Number(messageId), { isUnread: false })
    const thread = await db.threads.get(Number(threadId))
    if (!thread) return
    const newCount = Math.max(0, (thread.unreadCount || 0) - 1)
    await db.threads.update(Number(threadId), { unreadCount: newCount })
  })
  window.dispatchEvent(new CustomEvent('threads-changed'))
  broadcastChannel.postMessage({ type: 'unread-updated', threadId: Number(threadId) })
}

export async function clearUnread(threadId) {
  await db.transaction('rw', db.threads, db.messages, async () => {
    await db.threads.update(Number(threadId), { unreadCount: 0 })
    const msgs = await db.messages.where('threadId').equals(Number(threadId)).toArray()
    const unreadIds = msgs.filter((m) => m.isUnread).map((m) => m.id)
    if (unreadIds.length > 0) {
      await Promise.all(unreadIds.map((id) => db.messages.update(id, { isUnread: false })))
    }
  })
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
