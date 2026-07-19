import db from '../db'
import { getSetting } from './settings'
import { replaceVars } from './chatApi'
import { getMessagesByThread, updateMessage, deleteMessage } from './messages'
import { updateThread } from './threads'

export async function getThreadMemories(threadId) {
  const id = Number(threadId)
  const memories = await db.threadMemories.where('threadId').equals(id).sortBy('createdAt')
  return memories.reverse()
}

export async function getThreadMemoriesAscending(threadId) {
  const id = Number(threadId)
  return db.threadMemories.where('threadId').equals(id).sortBy('createdAt')
}

async function resolveMemoryContext({ character, thread } = {}) {
  const memorySlots = character?.memorySlots ?? (await getSetting('defaultMemorySlots')) ?? 3
  const memoriesHeader = (await getSetting('prompting.apiRequestSectionHeaders.memories')) || ''
  const memoryEntry = (await getSetting('prompting.apiRequestSectionHeaders.memoryEntry')) || ''

  let charName = character?.name || ''
  let personaName = ''
  let currentPersonaName = ''
  const threadId = thread?.id ?? character?.threadId
  if (thread?.personaId) {
    const persona = await db.personas.get(thread.personaId)
    personaName = persona?.name || ''
  }
  currentPersonaName = personaName

  return {
    memorySlots,
    memoriesHeader,
    memoryEntry,
    charName,
    personaName,
    currentPersonaName,
    threadId,
  }
}

function formatMemoryEntry(
  content,
  { seq, memorySlots, memoryEntry, charName, personaName, currentPersonaName },
) {
  if (memorySlots <= 1) return content
  const level = Math.floor((seq - 1) / memorySlots) + 1
  const slot = ((seq - 1) % memorySlots) + 1
  const vars = { charName, personaName, currentPersonaName }
  const entryHeader = memoryEntry
    ? replaceVars(memoryEntry, vars)
        .replace(/{{level}}/gi, String(level))
        .replace(/{{slot}}/gi, String(slot))
    : ''
  return entryHeader ? `${entryHeader}\n\n${content}` : content
}

export async function buildInjectedMemory(character, thread, { beforeDate } = {}) {
  const {
    memorySlots,
    memoriesHeader,
    memoryEntry,
    charName,
    personaName,
    currentPersonaName,
    threadId,
  } = await resolveMemoryContext({ character, thread })
  if (!threadId) return ''

  let memories = await getThreadMemoriesAscending(threadId)
  memories.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))

  // Migration: legacy threads stored a single memory string on the thread row.
  if (memories.length === 0) {
    const latestThread = await db.threads.get(Number(threadId))
    if (latestThread?.memory) {
      await createThreadMemory({ threadId: Number(threadId), content: latestThread.memory })
      memories = await getThreadMemoriesAscending(threadId)
      memories.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    }
  }

  // During regeneration, exclude memories created after the message's position
  // so the regenerated response sees only the context that was originally available.
  if (beforeDate) {
    memories = memories.filter((m) => new Date(m.createdAt) <= beforeDate)
  }

  const window = memories.slice(-memorySlots)
  if (window.length === 0) return ''

  const blocks = window.map((m) =>
    formatMemoryEntry(m.content || '', {
      seq: m.seq ?? 1,
      memorySlots,
      memoryEntry,
      charName,
      personaName,
      currentPersonaName,
    }),
  )

  const body = blocks.join('\n\n')
  return memoriesHeader ? `${memoriesHeader}\n\n${body}` : body
}

export async function getLatestThreadMemory(threadId) {
  const memories = await getThreadMemories(threadId)
  return memories[0] || null
}

export async function createThreadMemory({
  threadId,
  content,
  payload,
  model,
  params,
  apiDurationMs = null,
}) {
  const now = new Date()
  const id2 = Number(threadId)
  const existing = await db.threadMemories.where('threadId').equals(id2).toArray()
  const nextSeq = existing.reduce((max, m) => Math.max(max, m.seq || 0), 0) + 1

  const id = await db.threadMemories.add({
    threadId: id2,
    content: content || '',
    payload,
    model: model || '',
    params: params || null,
    apiDurationMs,
    isRead: false,
    seq: nextSeq,
    createdAt: now,
    updatedAt: now,
  })
  window.dispatchEvent(new CustomEvent('memories-changed', { detail: { threadId: id2 } }))
  return id
}

export async function updateThreadMemory(id, data) {
  return db.threadMemories.update(Number(id), { ...data, updatedAt: new Date() })
}

export async function deleteThreadMemory(id, threadId) {
  await db.threadMemories.delete(Number(id))
  window.dispatchEvent(
    new CustomEvent('memories-changed', { detail: { threadId: Number(threadId) } }),
  )
}

export async function markMemoryRead(id) {
  await db.threadMemories.update(Number(id), { isRead: true })
}

export async function getUnreadMemoryCount(threadId) {
  const id = Number(threadId)
  const memories = await db.threadMemories.where('threadId').equals(id).toArray()
  return memories.filter((m) => m.isRead === false).length
}

async function resequenceMemories(threadId) {
  const tid = Number(threadId)
  const memories = await db.threadMemories.where('threadId').equals(tid).sortBy('createdAt')
  await Promise.all(memories.map((m, i) => db.threadMemories.update(m.id, { seq: i + 1 })))
}

export async function deleteMemoryAndRevert(threadMemoryId, threadId) {
  const id = Number(threadMemoryId)
  const tid = Number(threadId)

  const memory = await db.threadMemories.get(id)
  if (!memory) return { markerDeleted: false, messagesReverted: 0 }

  const allMessages = await getMessagesByThread(tid)
  const markers = allMessages
    .filter((m) => m.isSummaryMarker)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  const memories = await db.threadMemories.where('threadId').equals(tid).sortBy('createdAt')
  const memIdx = memories.findIndex((m) => m.id === id)

  const prevMarker = memIdx > 0 ? markers[memIdx - 1] : null
  const thisMarker = markers[memIdx] || null

  const lowerBound = prevMarker ? new Date(prevMarker.createdAt).getTime() : 0
  const upperBound = thisMarker ? new Date(thisMarker.createdAt).getTime() : Infinity

  const messagesToRevert = allMessages.filter((m) => {
    if (!m.summarizedAt) return false
    if (m.isSummaryMarker || m.isAutoTitleMarker) return false
    const msgTime = new Date(m.createdAt).getTime()
    return msgTime > lowerBound && msgTime < upperBound
  })

  await Promise.all([
    db.threadMemories.delete(id),
    thisMarker ? deleteMessage(thisMarker.id) : Promise.resolve(),
    ...messagesToRevert.map((m) => updateMessage(m.id, { summarizedAt: null })),
  ])

  await resequenceMemories(tid)

  const remaining = await db.threadMemories.where('threadId').equals(tid).sortBy('createdAt')
  const nextMemory = remaining.length > 0 ? remaining[remaining.length - 1].content : null
  const threadUpdate = { memory: nextMemory, keptConsumedCount: 0 }
  if (remaining.length === 0) {
    threadUpdate.lastSummarizationAt = null
  }
  await updateThread(tid, threadUpdate)

  window.dispatchEvent(new CustomEvent('memories-changed', { detail: { threadId: tid } }))

  return { markerDeleted: !!thisMarker, messagesReverted: messagesToRevert.length }
}
