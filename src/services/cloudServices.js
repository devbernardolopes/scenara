import db from '../db'
import { getSetting, setSetting } from './settings'
import { showToast } from '../lib/toast'
import i18n from '../lib/i18n'
import { catboxUpload, catboxCreateAlbum, catboxAddToAlbum, extractFileRef } from './catbox'

export const SERVICE_TYPES = [
  {
    id: 'catbox',
    nameKey: 'settings:cloudService.types.catbox.name',
    descKey: 'settings:cloudService.types.catbox.desc',
    defaultBaseUrl: 'https://catbox.moe/user/api.php',
    credentialFields: [
      { key: 'userhash', labelKey: 'settings:cloudService.credentials.userhash', type: 'password' },
    ],
  },
  {
    id: 'github-gist',
    nameKey: 'settings:cloudService.types.githubGist.name',
    descKey: 'settings:cloudService.types.githubGist.desc',
    defaultBaseUrl: 'https://api.github.com',
    credentialFields: [
      { key: 'token', labelKey: 'settings:cloudService.credentials.githubToken', type: 'password' },
    ],
  },
]

const ORDER_KEY = 'cloudServiceOrder'

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

function fireChange(detail) {
  window.dispatchEvent(new CustomEvent('cloudServices-changed', { detail }))
}

export async function getAllServices() {
  const all = await db.cloudServices.orderBy('createdAt').toArray()
  return applyOrder(all)
}

export async function getService(id) {
  return db.cloudServices.get(id)
}

export async function createService(data) {
  const now = new Date()
  const id = await db.cloudServices.add({
    name: data.name,
    serviceType: data.serviceType,
    baseUrl: data.baseUrl || null,
    credentials: data.credentials || {},
    metadata: data.metadata || {},
    createdAt: now,
    updatedAt: now,
  })
  await appendToOrder(id)
  fireChange({ action: 'create', entityName: data.name })
  return id
}

export async function updateService(id, data) {
  await db.cloudServices.update(id, { ...data, updatedAt: new Date() })
  fireChange({ action: 'update', entityName: data.name })
  return id
}

export async function deleteService(id) {
  const svc = await db.cloudServices.get(id)
  await db.cloudServices.delete(id)
  await removeFromOrder(id)
  fireChange({ action: 'delete', entityName: svc?.name || 'Unknown' })
}

export async function deleteServices(ids) {
  const all = await getAllServices()
  if (ids.length >= all.length) {
    throw new Error('Cannot delete all cloud services')
  }
  await db.cloudServices.bulkDelete(ids)
  await removeManyFromOrder(ids)
  fireChange({ action: 'delete', count: ids.length })
}

export async function duplicateService(id) {
  const original = await db.cloudServices.get(id)
  if (!original) throw new Error('Service not found')
  const now = new Date()
  const newId = await db.cloudServices.add({
    name: `${original.name} (copy)`,
    serviceType: original.serviceType,
    baseUrl: original.baseUrl || null,
    credentials: { ...original.credentials },
    metadata: { ...original.metadata },
    createdAt: now,
    updatedAt: now,
  })
  await insertAfterInOrder(id, newId)
  fireChange({ action: 'duplicate', entityName: original.name })
  return newId
}

export async function duplicateServices(ids) {
  for (const id of ids) {
    await duplicateService(id)
  }
}

export async function exportService(id) {
  const svc = await db.cloudServices.get(id)
  if (!svc) {
    showToast(i18n.t('common:toast.export.invalidItem'), { type: 'error' })
    throw new Error('Service not found')
  }
  showToast(i18n.t('common:toast.cloudService.exported', { name: svc.name }), { type: 'success' })
  return {
    name: svc.name,
    serviceType: svc.serviceType,
    baseUrl: svc.baseUrl || null,
    credentials: { ...svc.credentials },
    metadata: { ...svc.metadata },
  }
}

export async function exportServices(ids) {
  const all = await Promise.all(ids.map((id) => exportService(id).catch(() => null)))
  const exported = all.filter(Boolean)
  if (exported.length > 0) {
    showToast(i18n.t('common:toast.cloudService.exportedMultiple', { count: exported.length }), {
      type: 'success',
    })
  }
  return exported
}

export async function importServices(items) {
  const validTypes = new Set(SERVICE_TYPES.map((t) => t.id))
  const added = []
  for (const item of items) {
    if (!item || !item.name || !item.name.trim()) continue
    if (!item.serviceType || !validTypes.has(item.serviceType)) continue
    const now = new Date()
    const id = await db.cloudServices.add({
      name: item.name.trim(),
      serviceType: item.serviceType,
      baseUrl: item.baseUrl || null,
      credentials: item.credentials || {},
      metadata: item.metadata || {},
      createdAt: now,
      updatedAt: now,
    })
    added.push(id)
  }
  if (added.length > 0) {
    const order = await getOrderIds()
    order.push(...added)
    await setSetting(ORDER_KEY, order)
    fireChange({ action: 'import', count: added.length })
  }
  return added
}

export async function updateCloudServiceOrder(order) {
  await setSetting(ORDER_KEY, order)
  fireChange({ action: 'reorder' })
}

export async function getCatboxService() {
  const all = await db.cloudServices.toArray()
  return all.find((s) => s.serviceType === 'catbox') || null
}

export async function ensureCatboxAlbum(serviceRecord, fileShortCode) {
  if (serviceRecord.metadata?.albumShort)
    return { short: serviceRecord.metadata.albumShort, created: false }
  const userhash = serviceRecord.credentials?.userhash || ''
  const { short } = await catboxCreateAlbum(
    userhash,
    'Scenara',
    'Scenara avatar uploads',
    fileShortCode || '',
  )
  await updateService(serviceRecord.id, {
    name: serviceRecord.name,
    serviceType: serviceRecord.serviceType,
    baseUrl: serviceRecord.baseUrl || null,
    credentials: { ...serviceRecord.credentials },
    metadata: { ...serviceRecord.metadata, albumShort: short },
  })
  return { short, created: true }
}

export async function catboxUploadAvatar(serviceRecord, dataUrl) {
  const userhash = serviceRecord.credentials?.userhash || ''
  const url = await catboxUpload(userhash, dataUrl)
  const fileCode = extractFileRef(url)
  const { short, created } = await ensureCatboxAlbum(serviceRecord, fileCode)
  if (!created && fileCode) {
    await catboxAddToAlbum(userhash, short, [fileCode])
  }
  return url
}

export async function getGistService() {
  const all = await db.cloudServices.toArray()
  return all.find((s) => s.serviceType === 'github-gist') || null
}
