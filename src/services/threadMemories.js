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
  return db.threadMemories.add({
    threadId: Number(threadId),
    content: content || '',
    payload,
    model: model || '',
    params: params || null,
    createdAt: now,
    updatedAt: now,
  })
}

export async function updateThreadMemory(id, data) {
  return db.threadMemories.update(Number(id), { ...data, updatedAt: new Date() })
}

export async function deleteThreadMemory(id) {
  return db.threadMemories.delete(Number(id))
}
