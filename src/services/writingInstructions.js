import db from '../db'

export async function getAllWritingInstructions() {
  return db.writingInstructions.orderBy('createdAt').toArray()
}

export async function getWritingInstruction(id) {
  return db.writingInstructions.get(id)
}

export async function createWritingInstruction(data) {
  const now = new Date()
  const id = await db.writingInstructions.add({
    name: data.name,
    content: data.content || '',
    createdAt: now,
    updatedAt: now,
  })
  window.dispatchEvent(new CustomEvent('writingInstructions-changed'))
  return id
}

export async function updateWritingInstruction(id, data) {
  await db.writingInstructions.update(id, { ...data, updatedAt: new Date() })
  window.dispatchEvent(new CustomEvent('writingInstructions-changed'))
  return id
}

export async function deleteWritingInstruction(id) {
  await db.writingInstructions.delete(id)
  window.dispatchEvent(new CustomEvent('writingInstructions-changed'))
}

export async function deleteWritingInstructions(ids) {
  await db.writingInstructions.bulkDelete(ids)
  window.dispatchEvent(new CustomEvent('writingInstructions-changed'))
}

export async function duplicateWritingInstruction(id) {
  const original = await db.writingInstructions.get(id)
  if (!original) throw new Error('Writing instruction not found')
  const now = new Date()
  const newId = await db.writingInstructions.add({
    name: `${original.name} (copy)`,
    content: original.content,
    createdAt: now,
    updatedAt: now,
  })
  window.dispatchEvent(new CustomEvent('writingInstructions-changed'))
  return newId
}

export async function duplicateWritingInstructions(ids) {
  for (const id of ids) {
    await duplicateWritingInstruction(id)
  }
}

export async function exportWritingInstruction(id) {
  const wi = await db.writingInstructions.get(id)
  if (!wi) throw new Error('Writing instruction not found')
  return { name: wi.name, content: wi.content }
}

export async function exportWritingInstructions(ids) {
  return Promise.all(ids.map((id) => exportWritingInstruction(id)))
}

export async function importWritingInstructions(items) {
  const added = []
  for (const item of items) {
    if (!item || !item.name || !item.name.trim()) continue
    const now = new Date()
    const id = await db.writingInstructions.add({
      name: item.name.trim(),
      content: item.content || '',
      createdAt: now,
      updatedAt: now,
    })
    added.push(id)
  }
  if (added.length > 0) {
    window.dispatchEvent(new CustomEvent('writingInstructions-changed'))
  }
  return added
}
