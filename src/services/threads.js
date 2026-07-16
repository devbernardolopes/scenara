import db from '../db'
import { setUIState } from './uiState'
import { touchCharacterLastUsed } from './characters'

export async function getAllThreads() {
  const all = await db.threads.toArray()
  all.sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1
    if (!a.isFavorite && b.isFavorite) return 1
    const aUnread = (a.unreadCount || 0) > 0
    const bUnread = (b.unreadCount || 0) > 0
    if (aUnread && !bUnread) return -1
    if (!aUnread && bUnread) return 1
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

export async function createThread({ characterId, personaId, title, initialMessages }) {
  const now = new Date()
  const threadNumber = await getNextThreadNumber()
  const id = await db.threads.add({
    characterId,
    personaId: personaId || null,
    title: title || 'New Chat',
    initialMessages: initialMessages || null,
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    isLocked: false,
    color: '',
    threadNumber,
    memory: null,
    lastSummarizationAt: null,
  })
  await touchCharacterLastUsed(characterId)
  window.dispatchEvent(
    new CustomEvent('threads-changed', {
      detail: { action: 'create', entityName: title || 'New Chat' },
    }),
  )
  return id
}

export async function updateThread(id, data) {
  const thread = await db.threads.get(Number(id))
  const updated = await db.threads.update(Number(id), { ...data, updatedAt: new Date() })
  if (updated) {
    if (thread) await touchCharacterLastUsed(thread.characterId)
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
  const updated = await db.threads.update(Number(id), { title, titleEdited: true })
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
  const thread = await db.threads.get(Number(id))
  await db.threads.update(Number(id), { updatedAt: new Date() })
  if (thread) await touchCharacterLastUsed(thread.characterId)
  window.dispatchEvent(new CustomEvent('threads-changed'))
}

export async function toggleFavorite(id) {
  const thread = await db.threads.get(Number(id))
  if (!thread) throw new Error('Thread not found')
  await db.threads.update(Number(id), { isFavorite: !thread.isFavorite })
  window.dispatchEvent(new CustomEvent('threads-changed'))
}

export async function toggleLock(id) {
  const thread = await db.threads.get(Number(id))
  if (!thread) throw new Error('Thread not found')
  await db.threads.update(Number(id), { isLocked: !thread.isLocked })
  window.dispatchEvent(new CustomEvent('threads-changed'))
}

export async function markAutoTitleGenerated(id) {
  await db.threads.update(Number(id), { autoTitleGenerated: true })
}

export async function updateThreadColor(id, color, colorSlot) {
  const data = { color }
  if (colorSlot !== undefined) data.colorSlot = colorSlot
  const updated = await db.threads.update(Number(id), data)
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
  await db.threadMemories.where('threadId').equals(numId).delete()
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
  await Promise.all(numIds.map((id) => db.threadMemories.where('threadId').equals(id).delete()))
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
    isLocked: false,
    color: '',
    threadNumber,
    titleEdited: original.titleEdited || false,
    autoTitleGenerated: original.autoTitleGenerated || false,
    memory: original.memory || null,
    lastSummarizationAt: original.lastSummarizationAt || null,
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
  const memories = await db.threadMemories.where('threadId').equals(Number(id)).toArray()
  if (memories.length > 0) {
    await db.threadMemories.bulkAdd(
      memories.map(({ id: _id, ...rest }) => ({
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
  const uiStateEntry = await db.uiState.where('key').equals(`chatInput.${id}`).first()
  if (uiStateEntry) {
    await setUIState(`chatInput.${newId}`, uiStateEntry.value)
  }
  window.dispatchEvent(
    new CustomEvent('threads-changed', {
      detail: { action: 'duplicate', entityName: newTitle },
    }),
  )
  return newId
}

export async function forkThread(id, messageId) {
  const original = await db.threads.get(Number(id))
  if (!original) throw new Error('Thread not found')
  const now = new Date()
  const threadNumber = await getNextThreadNumber()
  const newTitle = `${original.title} (Fork)`
  const newId = await db.threads.add({
    characterId: original.characterId,
    personaId: original.personaId,
    title: newTitle,
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    isLocked: false,
    color: '',
    threadNumber,
    titleEdited: original.titleEdited || false,
    autoTitleGenerated: original.autoTitleGenerated || false,
    memory: original.memory || null,
    lastSummarizationAt: original.lastSummarizationAt || null,
  })

  const allMessages = await db.messages.where('threadId').equals(Number(id)).sortBy('createdAt')
  const msgIdx = allMessages.findIndex((m) => m.id === Number(messageId))
  if (msgIdx === -1) throw new Error('Message not found')
  const messagesToCopy = allMessages.slice(0, msgIdx + 1)
  if (messagesToCopy.length > 0) {
    await db.messages.bulkAdd(
      messagesToCopy.map(({ id: _id, ...rest }) => ({
        ...rest,
        threadId: newId,
      })),
    )
  }

  const memories = await db.threadMemories.where('threadId').equals(Number(id)).toArray()
  const memoriesToCopy = memories.filter(
    (entry) =>
      !entry.createdAt || new Date(entry.createdAt) <= new Date(allMessages[msgIdx].createdAt),
  )
  if (memoriesToCopy.length > 0) {
    await db.threadMemories.bulkAdd(
      memoriesToCopy.map(({ id: _id, ...rest }) => ({
        ...rest,
        threadId: newId,
      })),
    )
  }

  const allPrompts = await db.promptHistory.where('threadId').equals(Number(id)).sortBy('createdAt')
  const copiedUserCount = messagesToCopy.filter((m) => m.role === 'user').length
  const promptsToCopy = allPrompts.slice(0, copiedUserCount)
  if (promptsToCopy.length > 0) {
    await db.promptHistory.bulkAdd(
      promptsToCopy.map(({ id: _id, ...rest }) => ({
        ...rest,
        threadId: newId,
      })),
    )
  }

  const uiStateEntry = await db.uiState.where('key').equals(`chatInput.${id}`).first()
  if (uiStateEntry) {
    await setUIState(`chatInput.${newId}`, uiStateEntry.value)
  }

  await touchCharacterLastUsed(original.characterId)
  window.dispatchEvent(
    new CustomEvent('threads-changed', {
      detail: { action: 'duplicate', entityName: newTitle },
    }),
  )
  return newId
}
