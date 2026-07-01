import db from '../db'
import { setSetting } from './settings'

export async function getAllPersonas() {
  const all = await db.personas.orderBy('createdAt').toArray()
  if (all.length === 0) {
    const now = new Date()
    const id = await db.personas.add({
      name: 'Anon',
      title: '',
      avatar: '',
      description: '',
      context: '',
      color: '',
      isDefault: 1,
      createdAt: now,
      updatedAt: now,
    })
    await setSetting('defaultPersonaId', id)
    window.dispatchEvent(new CustomEvent('personas-changed'))
    return db.personas.orderBy('createdAt').toArray()
  }
  return all
}

export async function getPersona(id) {
  return db.personas.get(id)
}

async function ensureSingleDefault(id, data) {
  if (data && data.isDefault) {
    const current = await db.personas.where('isDefault').equals(1).first()
    if (current && current.id !== id) {
      await db.personas.update(current.id, { isDefault: 0 })
    }
    await setSetting('defaultPersonaId', id)
  }
}

async function reassignDefault() {
  const all = await db.personas.orderBy('createdAt').toArray()
  if (all.length === 0) return
  const latest = all[all.length - 1]
  await db.personas.update(latest.id, { isDefault: 1 })
  await setSetting('defaultPersonaId', latest.id)
}

export async function createPersona(data) {
  const now = new Date()
  const id = await db.personas.add({
    name: data.name,
    title: data.title || '',
    avatar: data.avatar || '',
    description: data.description || '',
    context: data.context || '',
    color: data.color || '',
    isDefault: data.isDefault ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  })
  if (data.isDefault) {
    await ensureSingleDefault(id, { isDefault: true })
  }
  window.dispatchEvent(new CustomEvent('personas-changed'))
  return id
}

export async function updatePersona(id, data) {
  if ('isDefault' in data && !data.isDefault) {
    const all = await db.personas.toArray()
    if (all.length <= 1) {
      throw new Error('Cannot remove default from the last persona')
    }
  }
  await ensureSingleDefault(id, data)
  const safe = { ...data, updatedAt: new Date() }
  if ('isDefault' in safe) safe.isDefault = safe.isDefault ? 1 : 0
  await db.personas.update(id, safe)
  if ('isDefault' in data && !data.isDefault) {
    const stillHasDefault = await db.personas.where('isDefault').equals(1).count()
    if (!stillHasDefault) {
      await reassignDefault()
    }
  }
  window.dispatchEvent(new CustomEvent('personas-changed'))
  return id
}

export async function deletePersona(id) {
  const all = await db.personas.toArray()
  if (all.length <= 1) {
    throw new Error('Cannot delete the last persona')
  }
  const wasDefault = all.find((p) => p.id === id)?.isDefault
  await db.personas.delete(id)
  if (wasDefault) {
    await reassignDefault()
  } else {
    const stillHasDefault = await db.personas.where('isDefault').equals(1).count()
    if (!stillHasDefault) {
      await reassignDefault()
    }
  }
  window.dispatchEvent(new CustomEvent('personas-changed'))
}

export async function deletePersonas(ids) {
  const all = await db.personas.toArray()
  if (all.length <= 1) {
    throw new Error('Cannot delete the last persona')
  }
  if (ids.length >= all.length) {
    throw new Error('Cannot delete all personas')
  }
  const hadDefault = all.some((p) => ids.includes(p.id) && p.isDefault)
  await db.personas.bulkDelete(ids)
  if (hadDefault) {
    await reassignDefault()
  } else {
    const stillHasDefault = await db.personas.where('isDefault').equals(1).count()
    if (!stillHasDefault) {
      await reassignDefault()
    }
  }
  window.dispatchEvent(new CustomEvent('personas-changed'))
}

export async function duplicatePersona(id) {
  const original = await db.personas.get(id)
  if (!original) throw new Error('Persona not found')
  const now = new Date()
  const newId = await db.personas.add({
    name: original.name,
    title: original.title ? `${original.title} (copy)` : '',
    avatar: original.avatar,
    description: original.description,
    context: original.context,
    color: original.color,
    isDefault: 0,
    createdAt: now,
    updatedAt: now,
  })
  window.dispatchEvent(new CustomEvent('personas-changed'))
  return newId
}

export async function duplicatePersonas(ids) {
  for (const id of ids) {
    await duplicatePersona(id)
  }
}

export async function setDefaultPersona(id) {
  const all = await db.personas.toArray()
  for (const p of all) {
    await db.personas.update(p.id, { isDefault: p.id === id ? 1 : 0 })
  }
  await setSetting('defaultPersonaId', id)
  window.dispatchEvent(new CustomEvent('personas-changed'))
}

export async function exportPersona(id) {
  const p = await db.personas.get(id)
  if (!p) throw new Error('Persona not found')
  return {
    name: p.name,
    title: p.title,
    avatar: p.avatar,
    description: p.description,
    context: p.context,
    color: p.color,
  }
}

export async function exportPersonas(ids) {
  return Promise.all(ids.map((id) => exportPersona(id)))
}

export async function importPersonas(items) {
  const added = []
  for (const item of items) {
    if (!item || !item.name || !item.name.trim()) continue
    const now = new Date()
    const id = await db.personas.add({
      name: item.name.trim(),
      title: item.title || '',
      avatar: item.avatar || '',
      description: item.description || '',
      context: item.context || '',
      color: item.color || '',
      isDefault: 0,
      createdAt: now,
      updatedAt: now,
    })
    added.push(id)
  }
  if (added.length > 0) {
    window.dispatchEvent(new CustomEvent('personas-changed'))
  }
  return added
}
