import db from '../db'
import { updateThreadTimestamp } from './threads'

export async function getMessagesByThread(threadId) {
  return db.messages.where('threadId').equals(Number(threadId)).sortBy('createdAt')
}

export async function createMessage(threadId, role, content) {
  const id = await db.messages.add({
    threadId: Number(threadId),
    role,
    content,
    createdAt: new Date(),
  })
  await updateThreadTimestamp(threadId)
  return id
}

export async function deleteMessage(id) {
  return db.messages.delete(Number(id))
}

export async function deleteMessagesByThread(threadId) {
  return db.messages.where('threadId').equals(Number(threadId)).delete()
}
