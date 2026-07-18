import db from '../db'
import { getSetting, setSetting } from './settings'
import { getActiveKey, getActiveProvider, getModel, PROVIDERS } from './apiProviders'
import { showToast } from '../lib/toast'
import i18n from '../lib/i18n'

export const REQUEST_KINDS = ['chat', 'autoTitle', 'summarization', 'ooc', 'director', 'interface']

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

export async function updateConnectionProfileOrder(order) {
  await setSetting('connectionProfileOrder', order)
  window.dispatchEvent(new CustomEvent('connectionProfiles-changed'))
}

export async function getAllProfiles() {
  const all = await db.connectionProfiles.orderBy('createdAt').toArray()
  return applyOrder(all, 'connectionProfileOrder')
}

export async function getProfile(id) {
  return db.connectionProfiles.get(id)
}

export async function createProfile(data) {
  const now = new Date()
  const id = await db.connectionProfiles.add({
    name: data.name,
    providerId: data.providerId,
    keyId: data.keyId || null,
    model: data.model || null,
    params: data.params || {},
    createdAt: now,
    updatedAt: now,
  })
  await appendToOrder('connectionProfileOrder', id)
  window.dispatchEvent(
    new CustomEvent('connectionProfiles-changed', {
      detail: { action: 'create', entityName: data.name },
    }),
  )
  return id
}

export async function updateProfile(id, data) {
  await db.connectionProfiles.update(id, { ...data, updatedAt: new Date() })
  window.dispatchEvent(
    new CustomEvent('connectionProfiles-changed', {
      detail: { action: 'update', entityName: data.name },
    }),
  )
  return id
}

export async function deleteProfile(id) {
  const profile = await db.connectionProfiles.get(id)
  await db.connectionProfiles.delete(id)
  await removeFromOrder('connectionProfileOrder', id)
  for (const kind of REQUEST_KINDS) {
    const assigned = await getSetting(`requestKind.${kind}.profileId`)
    if (assigned === id) {
      await setSetting(`requestKind.${kind}.profileId`, null)
    }
  }
  window.dispatchEvent(
    new CustomEvent('connectionProfiles-changed', {
      detail: { action: 'delete', entityName: profile?.name || 'Unknown' },
    }),
  )
}

export async function duplicateProfile(id) {
  const original = await db.connectionProfiles.get(id)
  if (!original) throw new Error('Profile not found')
  const now = new Date()
  const newId = await db.connectionProfiles.add({
    name: `${original.name} (copy)`,
    providerId: original.providerId,
    keyId: original.keyId,
    model: original.model,
    params: { ...original.params },
    createdAt: now,
    updatedAt: now,
  })
  await insertAfterInOrder('connectionProfileOrder', id, newId)
  window.dispatchEvent(
    new CustomEvent('connectionProfiles-changed', {
      detail: { action: 'duplicate', entityName: original.name },
    }),
  )
  return newId
}

export async function deleteProfiles(ids) {
  const all = await getAllProfiles()
  if (ids.length >= all.length) {
    throw new Error('Cannot delete all connection profiles')
  }
  await db.connectionProfiles.bulkDelete(ids)
  await removeManyFromOrder('connectionProfileOrder', ids)
  for (const id of ids) {
    for (const kind of REQUEST_KINDS) {
      const assigned = await getSetting(`requestKind.${kind}.profileId`)
      if (assigned === id) {
        await setSetting(`requestKind.${kind}.profileId`, null)
      }
    }
  }
  window.dispatchEvent(
    new CustomEvent('connectionProfiles-changed', {
      detail: { action: 'delete', count: ids.length },
    }),
  )
}

export async function duplicateProfiles(ids) {
  for (const id of ids) {
    await duplicateProfile(id)
  }
}

export async function exportProfile(id) {
  const profile = await db.connectionProfiles.get(id)
  if (!profile) {
    showToast(i18n.t('common:toast.export.invalidItem'), { type: 'error' })
    throw new Error('Profile not found')
  }
  showToast(i18n.t('common:toast.connectionProfile.exported', { name: profile.name }), {
    type: 'success',
  })
  return {
    name: profile.name,
    providerId: profile.providerId,
    keyId: profile.keyId || null,
    model: profile.model || null,
    params: profile.params || {},
  }
}

export async function exportProfiles(ids) {
  const all = await Promise.all(ids.map((id) => exportProfile(id).catch(() => null)))
  const exported = all.filter(Boolean)
  if (exported.length > 0) {
    showToast(
      i18n.t('common:toast.connectionProfile.exportedMultiple', { count: exported.length }),
      { type: 'success' },
    )
  }
  return exported
}

export async function importProfiles(items) {
  const validIds = new Set(PROVIDERS.map((p) => p.id))
  const added = []
  for (const item of items) {
    if (!item || !item.name || !item.name.trim()) continue
    if (!item.providerId || !validIds.has(item.providerId)) continue
    const now = new Date()
    const id = await db.connectionProfiles.add({
      name: item.name.trim(),
      providerId: item.providerId,
      keyId: item.keyId || null,
      model: item.model || null,
      params: item.params || {},
      createdAt: now,
      updatedAt: now,
    })
    added.push(id)
  }
  if (added.length > 0) {
    const order = await getOrderIds('connectionProfileOrder')
    order.push(...added)
    await setSetting('connectionProfileOrder', order)
    window.dispatchEvent(
      new CustomEvent('connectionProfiles-changed', {
        detail: { action: 'import', count: added.length },
      }),
    )
  }
  return added
}

export async function usedByProfileCount(providerId, keyId) {
  const all = await getAllProfiles()
  return all.filter((p) => p.providerId === providerId && p.keyId === keyId).length
}

export async function getEffectiveProfileFor(requestKind) {
  let profileId = await getSetting(`requestKind.${requestKind}.profileId`)
  if (!profileId && requestKind !== 'chat') {
    profileId = await getSetting('requestKind.chat.profileId')
  }
  if (!profileId) return null
  const profile = await getProfile(profileId)
  if (!profile) return null
  const provider = PROVIDERS.find((p) => p.id === profile.providerId)
  if (!provider) return null
  let key = null
  if (provider.needsKey && profile.keyId) {
    const keys = await db.settings.where('key').equals(`api.${profile.providerId}.keys`).first()
    if (keys) {
      try {
        const parsed = JSON.parse(keys.value)
        const entry = parsed.find((k) => k.id === profile.keyId)
        if (entry) key = entry.value
      } catch {
        /* key entry not parseable */
      }
    }
  }
  return {
    providerId: profile.providerId,
    key,
    model: profile.model,
    params: { ...profile.params },
  }
}

// Resolves the effective Top P for a resolved profile, falling back to the
// provider's declared default when the profile does not override it.
export function getEffectiveTopP(profile) {
  if (!profile) return null
  const raw = profile.params?.top_p
  if (raw !== undefined && raw !== null && raw !== '') return Number(raw)
  const provider = PROVIDERS.find((p) => p.id === profile.providerId)
  const def = provider?.params?.find((p) => p.key === 'top_p')?.default
  return def !== undefined ? Number(def) : null
}

// Resolves the effective Temperature for a resolved profile, falling back to
// the provider's declared default when the profile does not override it.
export function getEffectiveTemperature(profile) {
  if (!profile) return null
  const raw = profile.params?.temperature
  if (raw !== undefined && raw !== null && raw !== '') return Number(raw)
  const provider = PROVIDERS.find((p) => p.id === profile.providerId)
  const def = provider?.params?.find((p) => p.key === 'temperature')?.default
  return def !== undefined ? Number(def) : null
}

export async function migrateFromOldSettings() {
  const already = await db.connectionProfiles.count()
  if (already > 0) return
  const activeProvider = await getActiveProvider()
  if (!activeProvider) return
  const model = await getModel(activeProvider)
  const activeKey = await getActiveKey(activeProvider)
  if (!model && !activeKey) return
  const now = new Date()
  const id = await db.connectionProfiles.add({
    name: 'Default',
    providerId: activeProvider,
    keyId: activeKey?.id || null,
    model: model || null,
    params: {},
    createdAt: now,
    updatedAt: now,
  })
  for (const kind of REQUEST_KINDS) {
    await setSetting(`requestKind.${kind}.profileId`, id)
  }
}
