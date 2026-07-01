import db from '../db'

export async function getUIState(key) {
  const row = await db.uiState.where('key').equals(key).first()
  return row?.value ?? null
}

export async function setUIState(key, value) {
  await db.uiState.put({ key, value })
}
