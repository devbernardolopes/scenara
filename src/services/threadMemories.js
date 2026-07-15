import db from '../db'
import { getSetting } from './settings'
import { replaceVars } from './chatApi'

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

export async function buildInjectedMemory(character, thread) {
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

export async function pruneThreadMemories(threadId, memorySlots) {
  const id = Number(threadId)
  const slots = Number(memorySlots) || 1
  const memories = await db.threadMemories.where('threadId').equals(id).sortBy('createdAt')
  if (memories.length <= slots) return
  const toDelete = memories.slice(0, memories.length - slots)
  await Promise.all(
    toDelete.map((m) =>
      db.threadMemories
        .delete(m.id)
        .then(() =>
          window.dispatchEvent(new CustomEvent('memories-changed', { detail: { threadId: id } })),
        ),
    ),
  )
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
