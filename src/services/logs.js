import db from '../db'

export const LOG_CAP = 5000

export async function addLog(entry) {
  const record = {
    type: entry.type || 'info',
    threadId: entry.threadId != null ? Number(entry.threadId) : null,
    level: entry.level || 'info',
    message: entry.message ?? null,
    providerId: entry.providerId ?? null,
    model: entry.model ?? null,
    request: entry.request ?? null,
    response: entry.response ?? null,
    status: entry.status ?? null,
    durationMs: entry.durationMs ?? null,
    error: entry.error ?? null,
    createdAt: entry.createdAt || new Date(),
  }

  const id = await db.logs.add(record)

  const count = await db.logs.count()
  if (count > LOG_CAP) {
    const excess = count - LOG_CAP
    const oldest = await db.logs.orderBy('createdAt').limit(excess).primaryKeys()
    if (oldest.length > 0) await db.logs.bulkDelete(oldest)
  }

  return id
}

export async function getLogs({
  type = null,
  threadId = null,
  level = null,
  search = '',
  sort = 'desc',
} = {}) {
  let rows = await db.logs.toArray()

  if (type) rows = rows.filter((r) => r.type === type)
  if (level) rows = rows.filter((r) => r.level === level)
  if (threadId != null && threadId !== '')
    rows = rows.filter((r) => r.threadId === Number(threadId))

  if (search) {
    const q = search.toLowerCase()
    rows = rows.filter((r) => {
      if (r.message && r.message.toLowerCase().includes(q)) return true
      if (r.model && r.model.toLowerCase().includes(q)) return true
      if (r.providerId && r.providerId.toLowerCase().includes(q)) return true
      if (r.error && String(r.error).toLowerCase().includes(q)) return true
      return false
    })
  }

  rows.sort((a, b) => {
    const ta = new Date(a.createdAt).getTime()
    const tb = new Date(b.createdAt).getTime()
    return sort === 'asc' ? ta - tb : tb - ta
  })

  return rows
}

export async function deleteLogs(ids) {
  if (ids.length === 0) return
  await db.logs.bulkDelete(ids)
}

export async function clearLogs() {
  await db.logs.clear()
}

export async function exportLogs({ type = null, threadId = null, search = '' } = {}) {
  const rows = await getLogs({ type, threadId, search, sort: 'desc' })
  return rows.map(({ id: _id, ...rest }) => rest)
}

export async function importLogs(items) {
  if (!Array.isArray(items)) return
  const added = []
  for (const item of items) {
    if (!item || !item.type) continue
    const { id: _id, ...rest } = item
    await db.logs.add({ ...rest, createdAt: rest.createdAt || new Date() })
    added.push(1)
  }
  return added.length
}
