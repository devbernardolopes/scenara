import db from '../db'
import { getSetting, setSetting } from './settings'
import { showToast } from '../lib/toast'
import i18n from '../lib/i18n'

const ORDER_KEY = 'inChatShortcutOrder'

async function getOrderIds() {
  let order = await getSetting(ORDER_KEY)
  return order && Array.isArray(order) ? order : []
}

async function applyOrder(all) {
  let order = await getSetting(ORDER_KEY)
  if (!order || !Array.isArray(order) || order.length === 0) {
    order = all.map((s) => s.id)
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

async function insertAfterInOrder(afterId, newId) {
  const order = await getOrderIds()
  const idx = order.indexOf(afterId)
  if (idx === -1) {
    order.push(newId)
  } else {
    order.splice(idx + 1, 0, newId)
  }
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

export async function updateInChatShortcutOrder(order) {
  await setSetting(ORDER_KEY, order)
  window.dispatchEvent(new CustomEvent('inChatShortcuts-changed'))
}

export async function getAllInChatShortcuts() {
  const all = await db.inChatShortcuts.orderBy('createdAt').toArray()
  return applyOrder(all)
}

export async function getInChatShortcut(id) {
  return db.inChatShortcuts.get(id)
}

export async function createInChatShortcut(data) {
  const now = new Date()
  const id = await db.inChatShortcuts.add({
    name: data.name,
    content: data.content || '',
    order: data.order || 'asc',
    createdAt: now,
    updatedAt: now,
  })
  await appendToOrder(id)
  window.dispatchEvent(
    new CustomEvent('inChatShortcuts-changed', {
      detail: { action: 'create', entityName: data.name },
    }),
  )
  return id
}

export async function updateInChatShortcut(id, data) {
  await db.inChatShortcuts.update(id, { ...data, updatedAt: new Date() })
  window.dispatchEvent(
    new CustomEvent('inChatShortcuts-changed', {
      detail: { action: 'update', entityName: data.name },
    }),
  )
  return id
}

export async function deleteInChatShortcut(id) {
  const item = await db.inChatShortcuts.get(id)
  await db.inChatShortcuts.delete(id)
  await removeFromOrder(id)
  window.dispatchEvent(
    new CustomEvent('inChatShortcuts-changed', {
      detail: { action: 'delete', entityName: item?.name || 'Unknown' },
    }),
  )
}

export async function deleteInChatShortcuts(ids) {
  await db.inChatShortcuts.bulkDelete(ids)
  await removeManyFromOrder(ids)
  window.dispatchEvent(
    new CustomEvent('inChatShortcuts-changed', { detail: { action: 'delete', count: ids.length } }),
  )
}

export async function duplicateInChatShortcut(id) {
  const original = await db.inChatShortcuts.get(id)
  if (!original) return
  const now = new Date()
  const newId = await db.inChatShortcuts.add({
    name: `${original.name} (Copy)`,
    content: original.content,
    createdAt: now,
    updatedAt: now,
  })
  await insertAfterInOrder(id, newId)
  window.dispatchEvent(
    new CustomEvent('inChatShortcuts-changed', {
      detail: { action: 'duplicate', entityName: original.name },
    }),
  )
  return newId
}

export async function duplicateInChatShortcuts(ids) {
  for (const id of ids) {
    await duplicateInChatShortcut(id)
  }
}

export async function exportInChatShortcut(id) {
  const wi = await db.inChatShortcuts.get(id)
  if (!wi) {
    showToast(i18n.t('common:toast.export.invalidItem'), { type: 'error' })
    throw new Error('In-chat shortcut not found')
  }
  showToast(i18n.t('common:toast.inChatShortcut.exported', { name: wi.name }), { type: 'success' })
  return { name: wi.name, content: wi.content }
}

export async function exportInChatShortcuts(ids) {
  const all = await Promise.all(ids.map((id) => exportInChatShortcut(id).catch(() => null)))
  const exported = all.filter(Boolean)
  if (exported.length > 0) {
    showToast(i18n.t('common:toast.inChatShortcut.exportedMultiple', { count: exported.length }), {
      type: 'success',
    })
  }
  return exported
}

export async function importInChatShortcuts(items) {
  const added = []
  for (const item of items) {
    if (!item || !item.name || !item.name.trim()) continue
    const now = new Date()
    const id = await db.inChatShortcuts.add({
      name: item.name.trim(),
      content: item.content || '',
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
      new CustomEvent('inChatShortcuts-changed', {
        detail: { action: 'import', count: added.length },
      }),
    )
  }
  return added
}
