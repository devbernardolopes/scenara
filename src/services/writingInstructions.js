import db from '../db'
import { showToast } from '../lib/toast'
import i18n from '../lib/i18n'
import { getSetting, setSetting } from './settings'

async function getOrderIds(orderKey) {
  let order = await getSetting(orderKey)
  return order && Array.isArray(order) ? order : []
}

async function applyOrder(all, orderKey) {
  let order = await getSetting(orderKey)
  if (!order || !Array.isArray(order) || order.length === 0) {
    order = all.map((p) => p.id)
    await setSetting(orderKey, order)
  }
  const orderMap = new Map(order.map((id, i) => [id, i]))
  all.sort((a, b) => {
    const ia = orderMap.get(a.id)
    const ib = orderMap.get(b.id)
    return (ia === undefined ? 999 : ia) - (ib === undefined ? 999 : ib)
  })
  return all
}

async function appendToOrder(orderKey, id) {
  const order = await getOrderIds(orderKey)
  order.push(id)
  await setSetting(orderKey, order)
}

async function insertAfterInOrder(orderKey, afterId, newId) {
  const order = await getOrderIds(orderKey)
  const idx = order.indexOf(afterId)
  if (idx === -1) {
    order.push(newId)
  } else {
    order.splice(idx + 1, 0, newId)
  }
  await setSetting(orderKey, order)
}

async function removeFromOrder(orderKey, id) {
  let order = await getOrderIds(orderKey)
  order = order.filter((oid) => oid !== id)
  await setSetting(orderKey, order)
}

async function removeManyFromOrder(orderKey, ids) {
  const removeSet = new Set(ids)
  let order = await getOrderIds(orderKey)
  order = order.filter((oid) => !removeSet.has(oid))
  await setSetting(orderKey, order)
}

export async function updateWritingInstructionOrder(order) {
  await setSetting('writingInstructionOrder', order)
  window.dispatchEvent(new CustomEvent('writingInstructions-changed'))
}

export async function getAllWritingInstructions() {
  const all = await db.writingInstructions.orderBy('createdAt').toArray()
  return applyOrder(all, 'writingInstructionOrder')
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
  await appendToOrder('writingInstructionOrder', id)
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
  await removeFromOrder('writingInstructionOrder', id)
  window.dispatchEvent(
    new CustomEvent('writingInstructions-changed', {
      detail: { action: 'delete', entityName: item?.name || 'Unknown' },
    }),
  )
}

export async function deleteWritingInstructions(ids) {
  await db.writingInstructions.bulkDelete(ids)
  await removeManyFromOrder('writingInstructionOrder', ids)
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
  await insertAfterInOrder('writingInstructionOrder', id, newId)
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
    const order = await getOrderIds('writingInstructionOrder')
    order.push(...added)
    await setSetting('writingInstructionOrder', order)
    window.dispatchEvent(
      new CustomEvent('writingInstructions-changed', {
        detail: { action: 'import', count: added.length },
      }),
    )
  }
  return added
}
