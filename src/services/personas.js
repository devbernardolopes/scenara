import db from '../db'
import { showToast } from '../lib/toast'
import i18n from '../lib/i18n'
import { getSetting, setSetting } from './settings'

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

async function getOrderIds(orderKey) {
  let order = await getSetting(orderKey)
  return order && Array.isArray(order) ? order : []
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

export async function updatePersonaOrder(order) {
  await setSetting('personaOrder', order)
  window.dispatchEvent(new CustomEvent('personas-changed'))
}

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
    await setSetting('personaOrder', [id])
    window.dispatchEvent(new CustomEvent('personas-changed'))
    return db.personas.orderBy('createdAt').toArray()
  }
  return applyOrder(all, 'personaOrder')
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
  await appendToOrder('personaOrder', id)
  window.dispatchEvent(
    new CustomEvent('personas-changed', {
      detail: { action: 'create', entityName: data.name },
    }),
  )
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
  window.dispatchEvent(
    new CustomEvent('personas-changed', {
      detail: { action: 'update', entityName: data.name },
    }),
  )
  return id
}

export async function deletePersona(id) {
  const all = await db.personas.toArray()
  if (all.length <= 1) {
    throw new Error('Cannot delete the last persona')
  }
  const target = all.find((p) => p.id === id)
  const wasDefault = target?.isDefault
  await db.personas.delete(id)
  await removeFromOrder('personaOrder', id)
  if (wasDefault) {
    await reassignDefault()
  } else {
    const stillHasDefault = await db.personas.where('isDefault').equals(1).count()
    if (!stillHasDefault) {
      await reassignDefault()
    }
  }
  window.dispatchEvent(
    new CustomEvent('personas-changed', {
      detail: { action: 'delete', entityName: target?.name || 'Unknown' },
    }),
  )
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
  await removeManyFromOrder('personaOrder', ids)
  if (hadDefault) {
    await reassignDefault()
  } else {
    const stillHasDefault = await db.personas.where('isDefault').equals(1).count()
    if (!stillHasDefault) {
      await reassignDefault()
    }
  }
  window.dispatchEvent(
    new CustomEvent('personas-changed', {
      detail: { action: 'delete', count: ids.length },
    }),
  )
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
  await insertAfterInOrder('personaOrder', id, newId)
  window.dispatchEvent(
    new CustomEvent('personas-changed', {
      detail: { action: 'duplicate', entityName: original.name },
    }),
  )
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
  if (!p) {
    showToast(i18n.t('common:toast.export.invalidItem'), { type: 'error' })
    throw new Error('Persona not found')
  }
  showToast(i18n.t('common:toast.persona.exported', { name: p.name }), { type: 'success' })
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
  const all = await Promise.all(ids.map((id) => exportPersona(id).catch(() => null)))
  const exported = all.filter(Boolean)
  if (exported.length > 0) {
    showToast(i18n.t('common:toast.persona.exportedMultiple', { count: exported.length }), {
      type: 'success',
    })
  }
  return exported
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
    const order = await getOrderIds('personaOrder')
    order.push(...added)
    await setSetting('personaOrder', order)
    window.dispatchEvent(
      new CustomEvent('personas-changed', {
        detail: { action: 'import', count: added.length },
      }),
    )
  }
  return added
}
