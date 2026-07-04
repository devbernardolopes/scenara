import db from '../db'

export async function getAllThreads() {
  const all = await db.threads.toArray()
  all.sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1
    if (!a.isFavorite && b.isFavorite) return 1
    return new Date(b.updatedAt) - new Date(a.updatedAt)
  })
  return all
}

export async function getThread(id) {
  return db.threads.get(Number(id))
}

export async function getNextThreadNumber() {
  return db.transaction('rw', [db.settings, db.threads], async () => {
    const row = await db.settings.where('key').equals('threadCounter').first()
    if (row) {
      const next = row.value + 1
      await db.settings.update(row.id, { value: next })
      return next
    }
    const all = await db.threads.toArray()
    const max = all.reduce((m, t) => Math.max(m, t.threadNumber || 0), 0)
    const next = max + 1
    await db.settings.add({ key: 'threadCounter', value: next })
    return next
  })
}

export async function createThread({ characterId, personaId, title }) {
  const now = new Date()
  const threadNumber = await getNextThreadNumber()
  const id = await db.threads.add({
    characterId,
    personaId: personaId || null,
    title: title || 'New Chat',
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    color: '',
    threadNumber,
  })
  window.dispatchEvent(
    new CustomEvent('threads-changed', {
      detail: { action: 'create', entityName: title || 'New Chat' },
    }),
  )
  return id
}

export async function updateThread(id, data) {
  const updated = await db.threads.update(Number(id), { ...data, updatedAt: new Date() })
  if (updated) {
    window.dispatchEvent(
      new CustomEvent('threads-changed', {
        detail: { action: 'update' },
      }),
    )
    return id
  }
  throw new Error('Thread not found')
}

export async function updateThreadTitle(id, title) {
  const updated = await db.threads.update(Number(id), { title, manualTitle: true })
  if (updated) {
    window.dispatchEvent(
      new CustomEvent('threads-changed', {
        detail: { action: 'update' },
      }),
    )
    return id
  }
  throw new Error('Thread not found')
}

export async function updateThreadTimestamp(id) {
  await db.threads.update(Number(id), { updatedAt: new Date() })
  window.dispatchEvent(new CustomEvent('threads-changed'))
}

export async function toggleFavorite(id) {
  const thread = await db.threads.get(Number(id))
  if (!thread) throw new Error('Thread not found')
  await db.threads.update(Number(id), { isFavorite: !thread.isFavorite })
  window.dispatchEvent(new CustomEvent('threads-changed'))
}

export async function updateThreadColor(id, color) {
  const updated = await db.threads.update(Number(id), { color })
  if (updated) {
    window.dispatchEvent(new CustomEvent('threads-changed'))
    return id
  }
  throw new Error('Thread not found')
}

export async function deleteThread(id) {
  const numId = Number(id)
  const thread = await db.threads.get(numId)
  await db.messages.where('threadId').equals(numId).delete()
  await db.threads.delete(numId)
  window.dispatchEvent(
    new CustomEvent('threads-changed', {
      detail: { action: 'delete', entityName: thread?.title },
    }),
  )
}

export async function deleteThreads(ids) {
  const numIds = ids.map(Number)
  await Promise.all(numIds.map((id) => db.messages.where('threadId').equals(id).delete()))
  await db.threads.bulkDelete(numIds)
  window.dispatchEvent(
    new CustomEvent('threads-changed', {
      detail: { action: 'delete', count: ids.length },
    }),
  )
}

export async function duplicateThread(id) {
  const original = await db.threads.get(Number(id))
  if (!original) throw new Error('Thread not found')
  const now = new Date()
  const threadNumber = await getNextThreadNumber()
  const newTitle = `${original.title} (Copy)`
  const newId = await db.threads.add({
    characterId: original.characterId,
    personaId: original.personaId,
    title: newTitle,
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    color: '',
    threadNumber,
  })
  const messages = await db.messages.where('threadId').equals(Number(id)).toArray()
  if (messages.length > 0) {
    await db.messages.bulkAdd(
      messages.map(({ id: _id, ...rest }) => ({
        ...rest,
        threadId: newId,
      })),
    )
  }
  const promptEntries = await db.promptHistory.where('threadId').equals(Number(id)).toArray()
  if (promptEntries.length > 0) {
    await db.promptHistory.bulkAdd(
      promptEntries.map(({ id: _id, ...rest }) => ({
        ...rest,
        threadId: newId,
      })),
    )
  }
  window.dispatchEvent(
    new CustomEvent('threads-changed', {
      detail: { action: 'duplicate', entityName: newTitle },
    }),
  )
  return newId
}
