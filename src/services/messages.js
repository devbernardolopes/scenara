import db from '../db'
import { updateThreadTimestamp } from './threads'

export async function getThreadMessageCounts() {
  const all = await db.messages.toArray()
  const counts = new Map()
  for (const m of all) {
    if (m?.isSummaryMarker || m?.isAutoTitleMarker) continue
    counts.set(m.threadId, (counts.get(m.threadId) || 0) + 1)
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
  await db.messages.delete(Number(id))
  if (threadId != null) {
    await updateThreadTimestamp(threadId)
    window.dispatchEvent(new CustomEvent('messages-changed', { detail: { threadId } }))
  }
}

export async function deleteMessagesFrom(id) {
  const msg = await db.messages.get(Number(id))
  if (!msg) return
  const allInThread = await db.messages.where('threadId').equals(msg.threadId).sortBy('createdAt')
  const idx = allInThread.findIndex((m) => m.id === msg.id)
  if (idx === -1) return
  const toDelete = allInThread
    .slice(idx)
    .filter((m) => !m.isSummaryMarker && !m.isAutoTitleMarker)
    .map((m) => m.id)
  if (toDelete.length === 0) return
  await db.messages.bulkDelete(toDelete)
  await updateThreadTimestamp(msg.threadId)
  window.dispatchEvent(new CustomEvent('messages-changed', { detail: { threadId: msg.threadId } }))
}

export async function deleteMessagesByThread(threadId) {
  const result = await db.messages.where('threadId').equals(Number(threadId)).delete()
  window.dispatchEvent(new CustomEvent('messages-changed', { detail: { threadId } }))
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
