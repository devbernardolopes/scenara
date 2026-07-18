import db from '../db'
import { getSetting, setSetting } from './settings'
import { showToast } from '../lib/toast'
import i18n from '../lib/i18n'

const ORDER_KEY = 'lorebookOrder'

async function getOrderIds() {
  let order = await getSetting(ORDER_KEY)
  return order && Array.isArray(order) ? order : []
}

async function applyOrder(all) {
  let order = await getSetting(ORDER_KEY)
  if (!order || !Array.isArray(order) || order.length === 0) {
    order = all.map((l) => l.id)
    await setSetting(ORDER_KEY, order)
  }
  const orderMap = new Map(order.map((id, i) => [id, i]))
  all.sort((a, b) => {
    const ia = orderMap.get(a.id)
    const ib = orderMap.get(b.id)
    return (ia === undefined ? 999 : ia) - (ib === undefined ? 999 : ib)
  })
  return all
}

async function appendToOrder(id) {
  const order = await getOrderIds()
  order.push(id)
  await setSetting(ORDER_KEY, order)
}

async function removeFromOrder(id) {
  let order = await getOrderIds()
  order = order.filter((oid) => oid !== id)
  await setSetting(ORDER_KEY, order)
}

async function removeManyFromOrder(ids) {
  const removeSet = new Set(ids)
  let order = await getOrderIds()
  order = order.filter((oid) => !removeSet.has(oid))
  await setSetting(ORDER_KEY, order)
}

export async function updateLorebookOrder(order) {
  await setSetting(ORDER_KEY, order)
  window.dispatchEvent(new CustomEvent('lorebooks-changed'))
}

export async function getAllLorebooks() {
  const all = await db.lorebooks.orderBy('createdAt').toArray()
  return applyOrder(all)
}

export async function getLorebook(id) {
  return db.lorebooks.get(id)
}

// Entry management is deferred. createLorebook/updateLorebook are stubbed to
// persist only the container (name + avatar) so the management UI is functional
// while lore entry editing is implemented separately.
export async function createLorebook(data) {
  const now = new Date()
  const id = await db.lorebooks.add({
    name: data.name,
    avatar: data.avatar || '',
    createdAt: now,
    updatedAt: now,
  })
  await appendToOrder(id)
  window.dispatchEvent(
    new CustomEvent('lorebooks-changed', { detail: { action: 'create', entityName: data.name } }),
  )
  return id
}

export async function updateLorebook(id, data) {
  await db.lorebooks.update(id, { ...data, updatedAt: new Date() })
  window.dispatchEvent(
    new CustomEvent('lorebooks-changed', { detail: { action: 'update', entityName: data.name } }),
  )
  return id
}

export async function deleteLorebook(id) {
  const item = await db.lorebooks.get(id)
  await db.lorebooks.delete(id)
  await removeFromOrder(id)
  window.dispatchEvent(
    new CustomEvent('lorebooks-changed', {
      detail: { action: 'delete', entityName: item?.name || 'Unknown' },
    }),
  )
}

export async function deleteLorebooks(ids) {
  await db.lorebooks.bulkDelete(ids)
  await removeManyFromOrder(ids)
  window.dispatchEvent(
    new CustomEvent('lorebooks-changed', { detail: { action: 'delete', count: ids.length } }),
  )
}

export async function duplicateLorebook(id) {
  const original = await db.lorebooks.get(id)
  if (!original) throw new Error('Lorebook not found')
  const now = new Date()
  const newId = await db.lorebooks.add({
    name: `${original.name} (copy)`,
    avatar: original.avatar,
    createdAt: now,
    updatedAt: now,
  })
  const order = await getOrderIds()
  const idx = order.indexOf(id)
  if (idx === -1) order.push(newId)
  else order.splice(idx + 1, 0, newId)
  await setSetting(ORDER_KEY, order)
  window.dispatchEvent(
    new CustomEvent('lorebooks-changed', {
      detail: { action: 'duplicate', entityName: original.name },
    }),
  )
  return newId
}

export async function duplicateLorebooks(ids) {
  for (const id of ids) {
    await duplicateLorebook(id)
  }
}

export async function exportLorebook(id) {
  const l = await db.lorebooks.get(id)
  if (!l) {
    showToast(i18n.t('common:toast.export.invalidItem'), { type: 'error' })
    throw new Error('Lorebook not found')
  }
  showToast(i18n.t('common:toast.lorebook.exported', { name: l.name }), { type: 'success' })
  return { name: l.name, avatar: l.avatar }
}

export async function exportLorebooks(ids) {
  const all = await Promise.all(ids.map((id) => exportLorebook(id).catch(() => null)))
  const exported = all.filter(Boolean)
  if (exported.length > 0) {
    showToast(i18n.t('common:toast.lorebook.exportedMultiple', { count: exported.length }), {
      type: 'success',
    })
  }
  return exported
}

export async function importLorebooks(items) {
  const added = []
  for (const item of items) {
    if (!item || !item.name || !item.name.trim()) continue
    const now = new Date()
    const id = await db.lorebooks.add({
      name: item.name.trim(),
      avatar: item.avatar || '',
      createdAt: now,
      updatedAt: now,
    })
    added.push(id)
  }
  if (added.length > 0) {
    const order = await getOrderIds()
    order.push(...added)
    await setSetting(ORDER_KEY, order)
    window.dispatchEvent(
      new CustomEvent('lorebooks-changed', {
        detail: { action: 'import', count: added.length },
      }),
    )
  }
  return added
}
