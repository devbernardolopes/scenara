import db from '../db'

export async function getAllThreads() {
  return db.threads.orderBy('updatedAt').reverse().toArray()
}

export async function getThread(id) {
  return db.threads.get(Number(id))
}

export async function createThread({ characterId, personaId, title }) {
  const now = new Date()
  return db.threads.add({
    characterId,
    personaId: personaId || null,
    title: title || 'New Chat',
    createdAt: now,
    updatedAt: now,
  })
}

export async function updateThread(id, data) {
  const updated = await db.threads.update(Number(id), { ...data, updatedAt: new Date() })
  if (updated) return id
  throw new Error('Thread not found')
}

export async function deleteThread(id) {
  const numId = Number(id)
  await db.messages.where('threadId').equals(numId).delete()
  return db.threads.delete(numId)
}
