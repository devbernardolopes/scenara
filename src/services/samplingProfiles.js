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

export async function updateSamplingProfileOrder(order) {
  await setSetting('samplingProfileOrder', order)
  window.dispatchEvent(new CustomEvent('samplingProfiles-changed'))
}

export async function getAllSamplingProfiles() {
  const all = await db.samplingProfiles.orderBy('createdAt').toArray()
  return applyOrder(all, 'samplingProfileOrder')
}

export async function getSamplingProfile(id) {
  return db.samplingProfiles.get(id)
}

export async function createSamplingProfile(data) {
  const now = new Date()
  const id = await db.samplingProfiles.add({
    name: data.name,
    params: data.params || {},
    createdAt: now,
    updatedAt: now,
  })
  await appendToOrder('samplingProfileOrder', id)
  window.dispatchEvent(
    new CustomEvent('samplingProfiles-changed', {
      detail: { action: 'create', entityName: data.name },
    }),
  )
  return id
}

export async function updateSamplingProfile(id, data) {
  await db.samplingProfiles.update(id, { ...data, updatedAt: new Date() })
  window.dispatchEvent(
    new CustomEvent('samplingProfiles-changed', {
      detail: { action: 'update', entityName: data.name },
    }),
  )
  return id
}

export async function deleteSamplingProfile(id) {
  const item = await db.samplingProfiles.get(id)
  await db.samplingProfiles.delete(id)
  await removeFromOrder('samplingProfileOrder', id)
  window.dispatchEvent(
    new CustomEvent('samplingProfiles-changed', {
      detail: { action: 'delete', entityName: item?.name || 'Unknown' },
    }),
  )
}

export async function deleteSamplingProfiles(ids) {
  await db.samplingProfiles.bulkDelete(ids)
  await removeManyFromOrder('samplingProfileOrder', ids)
  window.dispatchEvent(
    new CustomEvent('samplingProfiles-changed', {
      detail: { action: 'delete', count: ids.length },
    }),
  )
}

export async function duplicateSamplingProfile(id) {
  const original = await db.samplingProfiles.get(id)
  if (!original) throw new Error('Sampling profile not found')
  const now = new Date()
  const newId = await db.samplingProfiles.add({
    name: `${original.name} (copy)`,
    params: { ...original.params },
    createdAt: now,
    updatedAt: now,
  })
  await insertAfterInOrder('samplingProfileOrder', id, newId)
  window.dispatchEvent(
    new CustomEvent('samplingProfiles-changed', {
      detail: { action: 'duplicate', entityName: original.name },
    }),
  )
  return newId
}

export async function duplicateSamplingProfiles(ids) {
  for (const id of ids) {
    await duplicateSamplingProfile(id)
  }
}

export async function exportSamplingProfile(id) {
  const item = await db.samplingProfiles.get(id)
  if (!item) {
    showToast(i18n.t('common:toast.export.invalidItem'), { type: 'error' })
    throw new Error('Sampling profile not found')
  }
  showToast(i18n.t('common:toast.samplingProfile.exported', { name: item.name }), {
    type: 'success',
  })
  return { name: item.name, params: item.params || {} }
}

export async function exportSamplingProfiles(ids) {
  const all = await Promise.all(ids.map((id) => exportSamplingProfile(id).catch(() => null)))
  const exported = all.filter(Boolean)
  if (exported.length > 0) {
    showToast(i18n.t('common:toast.samplingProfile.exportedMultiple', { count: exported.length }), {
      type: 'success',
    })
  }
  return exported
}

export async function importSamplingProfiles(items) {
  const added = []
  for (const item of items) {
    if (!item || !item.name || !item.name.trim()) continue
    const now = new Date()
    const id = await db.samplingProfiles.add({
      name: item.name.trim(),
      params: item.params && typeof item.params === 'object' ? item.params : {},
      createdAt: now,
      updatedAt: now,
    })
    added.push(id)
  }
  if (added.length > 0) {
    const order = await getOrderIds('samplingProfileOrder')
    order.push(...added)
    await setSetting('samplingProfileOrder', order)
    window.dispatchEvent(
      new CustomEvent('samplingProfiles-changed', {
        detail: { action: 'import', count: added.length },
      }),
    )
  }
  return added
}
