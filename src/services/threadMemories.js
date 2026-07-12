import db from '../db'

export async function getThreadMemories(threadId) {
  const id = Number(threadId)
  const memories = await db.threadMemories.where('threadId').equals(id).sortBy('createdAt')
  return memories.reverse()
}

export async function getLatestThreadMemory(threadId) {
  const memories = await getThreadMemories(threadId)
  return memories[0] || null
}

export async function createThreadMemory({ threadId, content, payload, model, params }) {
  const now = new Date()
  const id = await db.threadMemories.add({
    threadId: Number(threadId),
    content: content || '',
    payload,
    model: model || '',
    params: params || null,
    isRead: false,
    createdAt: now,
    updatedAt: now,
  })
  window.dispatchEvent(
    new CustomEvent('memories-changed', { detail: { threadId: Number(threadId) } }),
  )
  return id
}

export async function updateThreadMemory(id, data) {
  return db.threadMemories.update(Number(id), { ...data, updatedAt: new Date() })
}

export async function deleteThreadMemory(id, threadId) {
  await db.threadMemories.delete(Number(id))
  window.dispatchEvent(
    new CustomEvent('memories-changed', { detail: { threadId: Number(threadId) } }),
  )
}

export async function markMemoryRead(id) {
  await db.threadMemories.update(Number(id), { isRead: true })
}

export async function getUnreadMemoryCount(threadId) {
  const id = Number(threadId)
  const memories = await db.threadMemories.where('threadId').equals(id).toArray()
  return memories.filter((m) => m.isRead === false).length
}
