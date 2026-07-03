import db from '../db'

export async function getAllInChatShortcuts() {
  return db.inChatShortcuts.orderBy('createdAt').toArray()
}

export async function getInChatShortcut(id) {
  return db.inChatShortcuts.get(id)
}

export async function createInChatShortcut(data) {
  const now = new Date()
  const id = await db.inChatShortcuts.add({
    name: data.name,
    content: data.content || '',
    createdAt: now,
    updatedAt: now,
  })
  window.dispatchEvent(new CustomEvent('inChatShortcuts-changed'))
  return id
}

export async function updateInChatShortcut(id, data) {
  await db.inChatShortcuts.update(id, { ...data, updatedAt: new Date() })
  window.dispatchEvent(new CustomEvent('inChatShortcuts-changed'))
}

export async function deleteInChatShortcut(id) {
  await db.inChatShortcuts.delete(id)
  window.dispatchEvent(new CustomEvent('inChatShortcuts-changed'))
}

export async function duplicateInChatShortcut(id) {
  const original = await db.inChatShortcuts.get(id)
  if (!original) return
  const now = new Date()
  await db.inChatShortcuts.add({
    name: `${original.name} (Copy)`,
    content: original.content,
    createdAt: now,
    updatedAt: now,
  })
  window.dispatchEvent(new CustomEvent('inChatShortcuts-changed'))
}
