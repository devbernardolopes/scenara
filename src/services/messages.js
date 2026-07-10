import db from '../db'
import { updateThreadTimestamp } from './threads'

export async function getMessagesByThread(threadId) {
  return db.messages.where('threadId').equals(Number(threadId)).sortBy('createdAt')
}

export async function createMessage(threadId, role, content, personaId, isOOC = false) {
  const id = await db.messages.add({
    threadId: Number(threadId),
    role,
    content,
    personaId: personaId || null,
    isOOC: !!isOOC,
    createdAt: new Date(),
    summarizedAt: null,
  })
  if (role === 'user') {
    await db.promptHistory.add({
      threadId: Number(threadId),
      content,
      personaId: personaId || null,
      createdAt: new Date(),
    })
  }
  await updateThreadTimestamp(threadId)
  return id
}

export async function createAssistantMessage(threadId, content, createdAt, isOOC = false) {
  const id = await db.messages.add({
    threadId: Number(threadId),
    role: 'assistant',
    content,
    personaId: null,
    isOOC: !!isOOC,
    createdAt: createdAt || new Date(),
    summarizedAt: null,
  })
  await updateThreadTimestamp(threadId)
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
  return db.messages.delete(Number(id))
}

export async function deleteMessagesFrom(id) {
  const msg = await db.messages.get(Number(id))
  if (!msg) return
  const allInThread = await db.messages.where('threadId').equals(msg.threadId).sortBy('createdAt')
  const idx = allInThread.findIndex((m) => m.id === msg.id)
  if (idx === -1) return
  const toDelete = allInThread.slice(idx).map((m) => m.id)
  return db.messages.bulkDelete(toDelete)
}

export async function deleteMessagesByThread(threadId) {
  return db.messages.where('threadId').equals(Number(threadId)).delete()
}

export function trimLeadingTrailingNewlines(text) {
  if (!text) return text
  return text.replace(/^\n+|\n+$/g, '')
}
