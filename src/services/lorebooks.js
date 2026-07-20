import db from '../db'
import { getSetting, setSetting } from './settings'
import { showToast } from '../lib/toast'
import i18n from '../lib/i18n'
import { createEntry, deleteEntriesForLorebook, getEntriesForLorebook } from './lorebookEntries'
import { mapLorebookFromST, mapLorebookToST } from './lorebookImportExport'

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

export async function getAllLorebooks({ isGlobal } = {}) {
  let all = await db.lorebooks.orderBy('createdAt').toArray()
  if (typeof isGlobal === 'boolean') {
    all = all.filter((l) => l.isGlobal === isGlobal)
  }
  return applyOrder(all)
}

export async function getLorebook(id) {
  return db.lorebooks.get(id)
}

export async function createLorebook(data) {
  const now = new Date()
  const id = await db.lorebooks.add({
    name: data.name,
    avatar: data.avatar || '',
    description: data.description || '',
    scanDepth: data.scanDepth ?? null,
    tokenBudget: data.tokenBudget ?? null,
    recursiveScanning: Boolean(data.recursiveScanning),
    isGlobal: Boolean(data.isGlobal),
    sourceMeta: data.sourceMeta ?? null,
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
  await deleteEntriesForLorebook(id)
  await removeFromOrder(id)
  await detachLorebookFromCharacters(id)
  window.dispatchEvent(
    new CustomEvent('lorebooks-changed', {
      detail: { action: 'delete', entityName: item?.name || 'Unknown' },
    }),
  )
}

export async function deleteLorebooks(ids) {
  await db.lorebooks.bulkDelete(ids)
  await db.lorebookEntries.where('lorebookId').anyOf(ids).delete()
  await removeManyFromOrder(ids)
  await Promise.all(ids.map((id) => detachLorebookFromCharacters(id)))
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
    description: original.description || '',
    scanDepth: original.scanDepth ?? null,
    tokenBudget: original.tokenBudget ?? null,
    recursiveScanning: Boolean(original.recursiveScanning),
    isGlobal: Boolean(original.isGlobal),
    sourceMeta: original.sourceMeta ?? null,
    createdAt: now,
    updatedAt: now,
  })

  const entries = await getEntriesForLorebook(id)
  for (const entry of entries) {
    await createEntry(newId, { ...entry })
  }

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
  const entries = await getEntriesForLorebook(id)
  const st = mapLorebookToST(l, entries)
  showToast(i18n.t('common:toast.lorebook.exported', { name: l.name }), { type: 'success' })
  return st
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
    const mapped = mapLorebookFromST(item)
    if (!mapped) continue
    const { lorebook, entries } = mapped
    if (!lorebook.name || !lorebook.name.trim()) continue
    const id = await createLorebook(lorebook)
    for (const entry of entries) {
      await createEntry(id, entry)
    }
    added.push(id)
  }
  if (added.length > 0) {
    window.dispatchEvent(
      new CustomEvent('lorebooks-changed', {
        detail: { action: 'import', count: added.length },
      }),
    )
  }
  return added
}

async function detachLorebookFromCharacters(lorebookId) {
  const chars = await db.characters.where('lorebookIds').equals(lorebookId).toArray()
  await Promise.all(
    chars.map((c) =>
      db.characters.update(c.id, {
        lorebookIds: (c.lorebookIds || []).filter((lid) => lid !== lorebookId),
      }),
    ),
  )
}
