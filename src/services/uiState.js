import db from '../db'

export async function getUIState(key) {
  const rows = await db.uiState.where('key').equals(key).toArray()
  if (rows.length > 1) {
    const keep = rows[rows.length - 1]
    await db.uiState.bulkDelete(rows.filter((r) => r.id !== keep.id).map((r) => r.id))
    return keep.value ?? null
  }
  return rows[0]?.value ?? null
}

export async function setUIState(key, value) {
  const existing = await db.uiState.where('key').equals(key).first()
  if (existing) {
    await db.uiState.update(existing.id, { value })
  } else {
    await db.uiState.add({ key, value })
  }
}
