import db from '../db'
import { updateThreadTimestamp } from './threads'

export async function getThreadMessageCounts() {
  const threads = await db.threads.toArray()
  const counts = new Map()
  for (const t of threads) {
    counts.set(t.id, t.messageCount || 0)
  }
  return counts
}

export async function getMessagesByThread(threadId) {
  return db.messages.where('threadId').equals(Number(threadId)).sortBy('createdAt')
}

export async function createMessage(
  threadId,
  role,
  content,
  personaId,
  isOOC = false,
  isHidden = false,
) {
  const id = await db.messages.add({
    threadId: Number(threadId),
    role,
    content,
    personaId: personaId || null,
    isOOC: !!isOOC,
    bundleMessages: JSON.stringify([{ content, hidden: !!isHidden }]),
    activeSlotIndex: 0,
    createdAt: new Date(),
    summarizedAt: null,
  })
  await db.threads
    .where('id')
    .equals(Number(threadId))
    .modify((t) => {
      t.messageCount = (t.messageCount || 0) + 1
    })
  if (role === 'user') {
    await db.promptHistory.add({
      threadId: Number(threadId),
      content,
      personaId: personaId || null,
      isOOC: !!isOOC,
      createdAt: new Date(),
    })
  }
  await updateThreadTimestamp(threadId)
  window.dispatchEvent(new CustomEvent('messages-changed', { detail: { threadId } }))
  return id
}

export async function createAssistantMessage(
  threadId,
  content,
  createdAt,
  isOOC = false,
  isHidden = false,
) {
  const id = await db.messages.add({
    threadId: Number(threadId),
    role: 'assistant',
    content,
    personaId: null,
    isOOC: !!isOOC,
    bundleMessages: JSON.stringify([{ content, hidden: !!isHidden }]),
    activeSlotIndex: 0,
    createdAt: createdAt || new Date(),
    summarizedAt: null,
  })
  await db.threads
    .where('id')
    .equals(Number(threadId))
    .modify((t) => {
      t.messageCount = (t.messageCount || 0) + 1
    })
  await updateThreadTimestamp(threadId)
  window.dispatchEvent(new CustomEvent('messages-changed', { detail: { threadId } }))
  return id
}

export async function createSummaryMarker(threadId, afterCreatedAt) {
  const id = await db.messages.add({
    threadId: Number(threadId),
    role: 'system',
    content: '',
    personaId: null,
    isOOC: false,
    isSummaryMarker: true,
    createdAt: new Date(new Date(afterCreatedAt).getTime() + 1),
    summarizedAt: null,
  })
  await updateThreadTimestamp(threadId)
  return id
}

export async function createAutoTitleMarker(threadId, afterCreatedAt) {
  const id = await db.messages.add({
    threadId: Number(threadId),
    role: 'system',
    content: '',
    personaId: null,
    isOOC: false,
    isAutoTitleMarker: true,
    createdAt: new Date(new Date(afterCreatedAt).getTime() + 1),
    summarizedAt: null,
  })
  await updateThreadTimestamp(threadId)
  return id
}

export async function updateMessage(id, updates) {
  return db.messages.update(Number(id), updates)
}

export async function deleteMessage(id) {
  const msg = await db.messages.get(Number(id))
  const threadId = msg?.threadId
  const isReal = msg && !msg.isSummaryMarker && !msg.isAutoTitleMarker
  const wasUnread = msg?.isUnread === true
  await db.messages.delete(Number(id))
  if (threadId != null) {
    if (isReal) {
      await db.threads
        .where('id')
        .equals(Number(threadId))
        .modify((t) => {
          t.messageCount = Math.max(0, (t.messageCount || 0) - 1)
          if (wasUnread) {
            t.unreadCount = Math.max(0, (t.unreadCount || 0) - 1)
          }
        })
    }
    await updateThreadTimestamp(threadId)
    window.dispatchEvent(new CustomEvent('messages-changed', { detail: { threadId } }))
    if (wasUnread) {
      window.dispatchEvent(new CustomEvent('threads-changed'))
      window.dispatchEvent(new CustomEvent('unread-changed'))
    }
  }
}

export async function deleteMessagesFrom(id) {
  const msg = await db.messages.get(Number(id))
  if (!msg) return
  const allInThread = await db.messages.where('threadId').equals(msg.threadId).sortBy('createdAt')
  const idx = allInThread.findIndex((m) => m.id === msg.id)
  if (idx === -1) return
  const toDeleteAll = allInThread.slice(idx)
  const toDelete = toDeleteAll
    .filter((m) => !m.isSummaryMarker && !m.isAutoTitleMarker)
    .map((m) => m.id)
  if (toDelete.length === 0) return
  const unreadCount = toDeleteAll.filter((m) => m.isUnread).length
  await db.messages.bulkDelete(toDelete)
  await db.threads
    .where('id')
    .equals(Number(msg.threadId))
    .modify((t) => {
      t.messageCount = Math.max(0, (t.messageCount || 0) - toDelete.length)
      if (unreadCount > 0) {
        t.unreadCount = Math.max(0, (t.unreadCount || 0) - unreadCount)
      }
    })
  await updateThreadTimestamp(msg.threadId)
  window.dispatchEvent(new CustomEvent('messages-changed', { detail: { threadId: msg.threadId } }))
  if (unreadCount > 0) {
    window.dispatchEvent(new CustomEvent('threads-changed'))
    window.dispatchEvent(new CustomEvent('unread-changed'))
  }
}

export async function deleteMessagesByThread(threadId) {
  const thread = await db.threads.get(Number(threadId))
  const hadUnread = (thread?.unreadCount || 0) > 0
  const result = await db.messages.where('threadId').equals(Number(threadId)).delete()
  await db.threads
    .where('id')
    .equals(Number(threadId))
    .modify((t) => {
      t.messageCount = 0
      t.unreadCount = 0
    })
  window.dispatchEvent(new CustomEvent('messages-changed', { detail: { threadId } }))
  if (hadUnread) {
    window.dispatchEvent(new CustomEvent('threads-changed'))
    window.dispatchEvent(new CustomEvent('unread-changed'))
  }
  return result
}

export function trimLeadingTrailingNewlines(text) {
  if (!text) return text
  return text.replace(/^\n+|\n+$/g, '')
}

export function trimWhitespace(text) {
  if (!text) return text
  return text.replace(/^\s+|\s+$/g, '')
}
