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

export async function updateStopSequenceOrder(order) {
  await setSetting('stopSequenceOrder', order)
  window.dispatchEvent(new CustomEvent('stopSequences-changed'))
}

export async function getAllStopSequences() {
  const all = await db.stopSequences.orderBy('createdAt').toArray()
  return applyOrder(all, 'stopSequenceOrder')
}

export async function getStopSequence(id) {
  return db.stopSequences.get(id)
}

export async function createStopSequence(data) {
  const now = new Date()
  const id = await db.stopSequences.add({
    name: data.name,
    sequences: data.sequences || [],
    createdAt: now,
    updatedAt: now,
  })
  await appendToOrder('stopSequenceOrder', id)
  window.dispatchEvent(
    new CustomEvent('stopSequences-changed', {
      detail: { action: 'create', entityName: data.name },
    }),
  )
  return id
}

export async function updateStopSequence(id, data) {
  await db.stopSequences.update(id, { ...data, updatedAt: new Date() })
  window.dispatchEvent(
    new CustomEvent('stopSequences-changed', {
      detail: { action: 'update', entityName: data.name },
    }),
  )
  return id
}

export async function deleteStopSequence(id) {
  const item = await db.stopSequences.get(id)
  await db.stopSequences.delete(id)
  await removeFromOrder('stopSequenceOrder', id)
  window.dispatchEvent(
    new CustomEvent('stopSequences-changed', {
      detail: { action: 'delete', entityName: item?.name || 'Unknown' },
    }),
  )
}

export async function deleteStopSequences(ids) {
  await db.stopSequences.bulkDelete(ids)
  await removeManyFromOrder('stopSequenceOrder', ids)
  window.dispatchEvent(
    new CustomEvent('stopSequences-changed', {
      detail: { action: 'delete', count: ids.length },
    }),
  )
}

export async function duplicateStopSequence(id) {
  const original = await db.stopSequences.get(id)
  if (!original) throw new Error('Stop sequence set not found')
  const now = new Date()
  const newId = await db.stopSequences.add({
    name: `${original.name} (copy)`,
    sequences: [...(original.sequences || [])],
    createdAt: now,
    updatedAt: now,
  })
  await insertAfterInOrder('stopSequenceOrder', id, newId)
  window.dispatchEvent(
    new CustomEvent('stopSequences-changed', {
      detail: { action: 'duplicate', entityName: original.name },
    }),
  )
  return newId
}

export async function duplicateStopSequences(ids) {
  for (const id of ids) {
    await duplicateStopSequence(id)
  }
}

export async function exportStopSequence(id) {
  const item = await db.stopSequences.get(id)
  if (!item) {
    showToast(i18n.t('common:toast.export.invalidItem'), { type: 'error' })
    throw new Error('Stop sequence set not found')
  }
  showToast(i18n.t('common:toast.stopSequence.exported', { name: item.name }), {
    type: 'success',
  })
  return { name: item.name, sequences: item.sequences || [] }
}

export async function exportStopSequences(ids) {
  const all = await Promise.all(ids.map((id) => exportStopSequence(id).catch(() => null)))
  const exported = all.filter(Boolean)
  if (exported.length > 0) {
    showToast(i18n.t('common:toast.stopSequence.exportedMultiple', { count: exported.length }), {
      type: 'success',
    })
  }
  return exported
}

export async function importStopSequences(items) {
  const added = []
  for (const item of items) {
    if (!item || !item.name || !item.name.trim()) continue
    const now = new Date()
    const id = await db.stopSequences.add({
      name: item.name.trim(),
      sequences: Array.isArray(item.sequences) ? item.sequences : [],
      createdAt: now,
      updatedAt: now,
    })
    added.push(id)
  }
  if (added.length > 0) {
    const order = await getOrderIds('stopSequenceOrder')
    order.push(...added)
    await setSetting('stopSequenceOrder', order)
    window.dispatchEvent(
      new CustomEvent('stopSequences-changed', {
        detail: { action: 'import', count: added.length },
      }),
    )
  }
  return added
}
