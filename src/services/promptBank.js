import db from '../db'
import { showToast } from '../lib/toast'
import i18n from '../lib/i18n'
import { getSetting, setSetting } from './settings'

const ORDER_KEY = 'promptBankOrder'
const BUILT_IN_KINDS = [
  'Summary — System',
  'Summary — User',
  'Auto-Title — System',
  'Auto-Title — User',
  'Director — System',
  'OOC — System',
  'OOC — User',
  'Persona Injection',
  'First Message Prompt',
  'Continue Prompt',
]

const SEED_MAP = {
  'Summary — System': 'prompting.summarizationSystem',
  'Summary — User': 'prompting.summarizationUser',
  'Auto-Title — System': 'prompting.autoTitleSystem',
  'Auto-Title — User': 'prompting.autoTitleUser',
  'Director — System': 'prompting.directorSystem',
  'OOC — System': 'prompting.oocSystem',
  'OOC — User': 'prompting.oocUser',
  'Persona Injection': 'prompting.personaInjectionTemplate',
  'First Message Prompt': 'prompting.firstMessagePrompt',
  'Continue Prompt': 'prompting.continuePrompt',
}

const NAME_MAP = {
  'Summary — System': 'Summary — System (default)',
  'Summary — User': 'Summary — User (default)',
  'Auto-Title — System': 'Auto-Title — System (default)',
  'Auto-Title — User': 'Auto-Title — User (default)',
  'Director — System': 'Director — System (default)',
  'OOC — System': 'OOC — System (default)',
  'OOC — User': 'OOC — User (default)',
  'Persona Injection': 'Persona Injection (default)',
  'First Message Prompt': 'First Message Prompt (default)',
  'Continue Prompt': 'Continue Prompt (default)',
}

export function getBuiltInKinds() {
  return [...BUILT_IN_KINDS]
}

export async function getAllKinds() {
  const entries = await db.promptBank.toArray()
  const userKinds = [
    ...new Set(entries.map((e) => e.kind).filter((k) => !BUILT_IN_KINDS.includes(k))),
  ]
  return [...BUILT_IN_KINDS, ...userKinds]
}

export async function getUserKinds() {
  const entries = await db.promptBank.toArray()
  return [...new Set(entries.map((e) => e.kind).filter((k) => !BUILT_IN_KINDS.includes(k)))]
}

export function isBuiltInKind(kind) {
  return BUILT_IN_KINDS.includes(kind)
}

async function getOrderIds() {
  let order = await getSetting(ORDER_KEY)
  return order && Array.isArray(order) ? order : []
}

async function applyOrder(all) {
  let order = await getSetting(ORDER_KEY)
  if (!order || !Array.isArray(order) || order.length === 0) {
    order = all.map((p) => p.id)
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

export async function updatePromptBankOrder(order) {
  await setSetting(ORDER_KEY, order)
  window.dispatchEvent(new CustomEvent('promptBank-changed'))
}

export async function getAllPromptBankEntries() {
  const all = await db.promptBank.orderBy('createdAt').toArray()
  return applyOrder(all)
}

export async function getPromptBankEntry(id) {
  return db.promptBank.get(id)
}

export async function createPromptBankEntry(data) {
  const now = new Date()
  const id = await db.promptBank.add({
    name: data.name,
    kind: data.kind || '',
    content: data.content || '',
    createdAt: now,
    updatedAt: now,
  })
  await appendToOrder(id)
  window.dispatchEvent(
    new CustomEvent('promptBank-changed', {
      detail: { action: 'create', entityName: data.name },
    }),
  )
  return id
}

export async function updatePromptBankEntry(id, data) {
  await db.promptBank.update(id, { ...data, updatedAt: new Date() })
  window.dispatchEvent(
    new CustomEvent('promptBank-changed', {
      detail: { action: 'update', entityName: data.name },
    }),
  )
  return id
}

export async function deletePromptBankEntry(id) {
  const item = await db.promptBank.get(id)
  await db.promptBank.delete(id)
  await removeFromOrder(id)
  window.dispatchEvent(
    new CustomEvent('promptBank-changed', {
      detail: { action: 'delete', entityName: item?.name || 'Unknown' },
    }),
  )
}

export async function deletePromptBankEntries(ids) {
  await db.promptBank.bulkDelete(ids)
  await removeManyFromOrder(ids)
  window.dispatchEvent(
    new CustomEvent('promptBank-changed', {
      detail: { action: 'delete', count: ids.length },
    }),
  )
}

export async function duplicatePromptBankEntry(id) {
  const original = await db.promptBank.get(id)
  if (!original) throw new Error('Prompt bank entry not found')
  const now = new Date()
  const newId = await db.promptBank.add({
    name: `${original.name} (copy)`,
    kind: original.kind,
    content: original.content,
    createdAt: now,
    updatedAt: now,
  })
  await insertAfterInOrder(id, newId)
  window.dispatchEvent(
    new CustomEvent('promptBank-changed', {
      detail: { action: 'duplicate', entityName: original.name },
    }),
  )
  return newId
}

export async function duplicatePromptBankEntries(ids) {
  for (const id of ids) {
    await duplicatePromptBankEntry(id)
  }
}

export async function exportPromptBankEntry(id) {
  const entry = await db.promptBank.get(id)
  if (!entry) {
    showToast(i18n.t('common:toast.export.invalidItem'), { type: 'error' })
    throw new Error('Prompt bank entry not found')
  }
  showToast(i18n.t('common:toast.promptBank.exported', { name: entry.name }), {
    type: 'success',
  })
  return { name: entry.name, kind: entry.kind, content: entry.content }
}

export async function exportPromptBankEntries(ids) {
  const all = await Promise.all(ids.map((id) => exportPromptBankEntry(id).catch(() => null)))
  const exported = all.filter(Boolean)
  if (exported.length > 0) {
    showToast(i18n.t('common:toast.promptBank.exportedMultiple', { count: exported.length }), {
      type: 'success',
    })
  }
  return exported
}

export async function importPromptBankEntries(items) {
  const added = []
  for (const item of items) {
    if (!item || !item.name || !item.name.trim()) continue
    const now = new Date()
    const id = await db.promptBank.add({
      name: item.name.trim(),
      kind: item.kind || '',
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
      new CustomEvent('promptBank-changed', {
        detail: { action: 'import', count: added.length },
      }),
    )
  }
  return added
}

export async function seedBuiltInEntries() {
  const existing = await db.promptBank.toArray()
  const existingKinds = new Set(existing.map((e) => e.kind))
  const toSeed = BUILT_IN_KINDS.filter((kind) => !existingKinds.has(kind))
  if (toSeed.length === 0) return

  for (const kind of toSeed) {
    const settingKey = SEED_MAP[kind]
    if (!settingKey) continue
    const content = await getSetting(settingKey)
    if (!content) continue
    const now = new Date()
    const id = await db.promptBank.add({
      name: NAME_MAP[kind] || kind,
      kind,
      content,
      createdAt: now,
      updatedAt: now,
    })
    await appendToOrder(id)
  }
}
