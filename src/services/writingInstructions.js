import db from '../db'
import { showToast } from '../lib/toast'
import i18n from '../lib/i18n'

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
  window.dispatchEvent(
    new CustomEvent('writingInstructions-changed', {
      detail: { action: 'create', entityName: data.name },
    }),
  )
  return id
}

export async function updateWritingInstruction(id, data) {
  await db.writingInstructions.update(id, { ...data, updatedAt: new Date() })
  window.dispatchEvent(
    new CustomEvent('writingInstructions-changed', {
      detail: { action: 'update', entityName: data.name },
    }),
  )
  return id
}

export async function deleteWritingInstruction(id) {
  const item = await db.writingInstructions.get(id)
  await db.writingInstructions.delete(id)
  window.dispatchEvent(
    new CustomEvent('writingInstructions-changed', {
      detail: { action: 'delete', entityName: item?.name || 'Unknown' },
    }),
  )
}

export async function deleteWritingInstructions(ids) {
  await db.writingInstructions.bulkDelete(ids)
  window.dispatchEvent(
    new CustomEvent('writingInstructions-changed', {
      detail: { action: 'delete', count: ids.length },
    }),
  )
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
  window.dispatchEvent(
    new CustomEvent('writingInstructions-changed', {
      detail: { action: 'duplicate', entityName: original.name },
    }),
  )
  return newId
}

export async function duplicateWritingInstructions(ids) {
  for (const id of ids) {
    await duplicateWritingInstruction(id)
  }
}

export async function exportWritingInstruction(id) {
  const wi = await db.writingInstructions.get(id)
  if (!wi) {
    showToast(i18n.t('common:toast.export.invalidItem'), { type: 'error' })
    throw new Error('Writing instruction not found')
  }
  showToast(i18n.t('common:toast.writingInstruction.exported', { name: wi.name }), {
    type: 'success',
  })
  return { name: wi.name, content: wi.content }
}

export async function exportWritingInstructions(ids) {
  const all = await Promise.all(ids.map((id) => exportWritingInstruction(id).catch(() => null)))
  const exported = all.filter(Boolean)
  if (exported.length > 0) {
    showToast(
      i18n.t('common:toast.writingInstruction.exportedMultiple', { count: exported.length }),
      {
        type: 'success',
      },
    )
  }
  return exported
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
    window.dispatchEvent(
      new CustomEvent('writingInstructions-changed', {
        detail: { action: 'import', count: added.length },
      }),
    )
  }
  return added
}
