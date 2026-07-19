import db from '../db'

const CHANGE_EVENT = 'lorebook-entries-changed'

function emit(lorebookId, detail = {}) {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { lorebookId, ...detail } }))
}

function nextOrder(lorebookId) {
  return db.lorebookEntries.where('lorebookId').equals(lorebookId).count()
}

export async function getEntriesForLorebook(lorebookId) {
  const all = await db.lorebookEntries.where('lorebookId').equals(lorebookId).toArray()
  all.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return all
}

export async function getEntry(id) {
  return db.lorebookEntries.get(id)
}

export async function createEntry(lorebookId, data) {
  const now = new Date()
  const id = await db.lorebookEntries.add({
    lorebookId,
    order: data.order ?? (await nextOrder(lorebookId)),
    name: data.name ?? '',
    keys: data.keys ?? [],
    secondaryKeys: data.secondaryKeys ?? [],
    secondaryLogic: data.secondaryLogic ?? null,
    content: data.content ?? '',
    constant: data.constant ?? false,
    enabled: data.enabled ?? true,
    position: data.position ?? 'before_char',
    insertionOrder: data.insertionOrder ?? 100,
    depth: data.depth ?? null,
    probability: data.probability ?? null,
    caseSensitive: data.caseSensitive ?? false,
    excludeRecursion: data.excludeRecursion ?? false,
    characterFilter: data.characterFilter ?? null,
    sourceMeta: data.sourceMeta ?? null,
    createdAt: now,
    updatedAt: now,
  })
  emit(lorebookId, { action: 'create', entityName: data.name })
  return id
}

export async function updateEntry(id, data) {
  const existing = await db.lorebookEntries.get(id)
  await db.lorebookEntries.update(id, { ...data, updatedAt: new Date() })
  emit(existing?.lorebookId, { action: 'update', entityName: data.name })
  return id
}

export async function deleteEntry(id) {
  const existing = await db.lorebookEntries.get(id)
  await db.lorebookEntries.delete(id)
  emit(existing?.lorebookId, { action: 'delete', entityName: existing?.name || 'Unknown' })
}

export async function duplicateEntry(id) {
  const original = await db.lorebookEntries.get(id)
  if (!original) throw new Error('Lorebook entry not found')
  const now = new Date()
  const maxOrder = await db.lorebookEntries
    .where('lorebookId')
    .equals(original.lorebookId)
    .toArray()
    .then((rows) => rows.reduce((m, r) => Math.max(m, r.order ?? 0), 0))
  const newId = await db.lorebookEntries.add({
    ...original,
    id: undefined,
    name: `${original.name} (copy)`,
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  })
  emit(original.lorebookId, { action: 'duplicate', entityName: original.name })
  return newId
}

export async function updateEntryOrder(lorebookId, orderedIds) {
  await db.transaction('rw', db.lorebookEntries, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.lorebookEntries.update(orderedIds[i], { order: i })
    }
  })
  emit(lorebookId, { action: 'reorder' })
}

export async function deleteEntriesForLorebook(lorebookId) {
  await db.lorebookEntries.where('lorebookId').equals(lorebookId).delete()
}
