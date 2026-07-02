import db from '../db'
import { getSetting, setSetting } from './settings'
import { getActiveKey, getActiveProvider, getModel, PROVIDERS } from './apiProviders'

export const REQUEST_KINDS = ['chat', 'autoTitle', 'summarization', 'director']

export async function getAllProfiles() {
  return db.connectionProfiles.orderBy('createdAt').toArray()
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
  window.dispatchEvent(
    new CustomEvent('connectionProfiles-changed', {
      detail: { action: 'duplicate', entityName: original.name },
    }),
  )
  return newId
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
