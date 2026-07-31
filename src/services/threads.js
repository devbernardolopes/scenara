import db from '../db'
import { setUIState } from './uiState'
import { touchCharacterLastUsed } from './characters'
import { cancelThreadRequests } from './apiQueue'

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

export async function createThread({
  characterId,
  personaId,
  title,
  initialMessages,
  statusBlock,
}) {
  const now = new Date()
  const threadNumber = await getNextThreadNumber()
  const id = await db.threads.add({
    characterId,
    personaId: personaId || null,
    title: title || 'New Chat',
    initialMessages: initialMessages || null,
    statusBlock: statusBlock || '',
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    isLocked: false,
    color: '',
    threadNumber,
    memory: null,
    lastSummarizationAt: null,
    messageCount: 0,
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
  cancelThreadRequests(numId, {
    kinds: ['chat', 'regenerate', 'autoTitle', 'summarization'],
  })
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
  for (const id of numIds) {
    cancelThreadRequests(id, {
      kinds: ['chat', 'regenerate', 'autoTitle', 'summarization'],
    })
  }
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
    activeScenario: original.activeScenario || null,
    statusBlock: original.statusBlock ?? null,
    messageCount: 0,
  })
  const messages = await db.messages.where('threadId').equals(Number(id)).toArray()
  if (messages.length > 0) {
    await db.messages.bulkAdd(
      messages.map(({ id: _id, ...rest }) => ({
        ...rest,
        threadId: newId,
      })),
    )
    const realCount = messages.filter((m) => !m.isSummaryMarker && !m.isAutoTitleMarker).length
    await db.threads
      .where('id')
      .equals(newId)
      .modify((t) => {
        t.messageCount = realCount
      })
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
    keptConsumedCount: original.keptConsumedCount || 0,
    activeScenario: original.activeScenario || null,
    statusBlock: original.statusBlock ?? null,
    messageCount: 0,
  })

  const allMessages = await db.messages.where('threadId').equals(Number(id)).sortBy('createdAt')
  const msgIdx = allMessages.findIndex((m) => m.id === Number(messageId))
  if (msgIdx === -1) throw new Error('Message not found')
  const forkCreatedAt = allMessages[msgIdx].createdAt
  const messagesToCopy = allMessages.slice(0, msgIdx + 1)
  if (messagesToCopy.length > 0) {
    await db.messages.bulkAdd(
      messagesToCopy.map(({ id: _id, ...rest }) => ({
        ...rest,
        threadId: newId,
        summarizedAt:
          rest.summarizedAt && new Date(rest.summarizedAt) > new Date(forkCreatedAt)
            ? null
            : rest.summarizedAt,
      })),
    )
    const realCount = messagesToCopy.filter(
      (m) => !m.isSummaryMarker && !m.isAutoTitleMarker,
    ).length
    await db.threads
      .where('id')
      .equals(newId)
      .modify((t) => {
        t.messageCount = realCount
      })
  }

  const memories = await db.threadMemories.where('threadId').equals(Number(id)).toArray()
  const memoriesToCopy = memories.filter(
    (entry) => !entry.createdAt || new Date(entry.createdAt) <= new Date(forkCreatedAt),
  )
  if (memoriesToCopy.length > 0) {
    await db.threadMemories.bulkAdd(
      memoriesToCopy.map(({ id: _id, ...rest }) => ({
        ...rest,
        threadId: newId,
      })),
    )
  }

  // Restore exact fork-point summarization state on the new thread.
  const fixedMessages = messagesToCopy.map((m) => ({
    ...m,
    summarizedAt:
      m.summarizedAt && new Date(m.summarizedAt) > new Date(forkCreatedAt) ? null : m.summarizedAt,
  }))

  const lastSummarized = fixedMessages
    .filter((m) => m.summarizedAt)
    .sort((a, b) => new Date(b.summarizedAt) - new Date(a.summarizedAt))[0]
  const correctLastSummarizationAt = lastSummarized?.summarizedAt || null

  const correctKeptConsumedCount = correctLastSummarizationAt
    ? fixedMessages.filter(
        (m) => m.role === 'user' && new Date(m.createdAt) > new Date(correctLastSummarizationAt),
      ).length
    : 0

  const sortedMemories = [...memoriesToCopy].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  )
  const correctMemory = sortedMemories[0]?.content || null

  await db.threads
    .where('id')
    .equals(newId)
    .modify((t) => {
      t.memory = correctMemory
      t.lastSummarizationAt = correctLastSummarizationAt
      t.keptConsumedCount = correctKeptConsumedCount
    })

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
