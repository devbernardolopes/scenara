import db from '../db'
import { showToast } from '../lib/toast'
import i18n, { resolveLanguage } from '../lib/i18n'
import { getSetting } from './settings'
import { getUIState, setUIState } from './uiState'

const BUILT_IN_SEED_KEY = 'builtInFoldersSeeded'
const BUILT_IN_FOLDER_KEYS = [
  'folders.builtIn.assistants',
  'folders.builtIn.characters',
  'folders.builtIn.scenarios',
  'folders.builtIn.trivias',
]

export async function seedBuiltInFolders() {
  const seeded = await getUIState(BUILT_IN_SEED_KEY)
  if (seeded) return
  const [characterCount, threadCount, folderCount] = await Promise.all([
    db.characters.count(),
    db.threads.count(),
    db.folders.count(),
  ])
  if (characterCount > 0 || threadCount > 0 || folderCount > 0) return

  const lang = resolveLanguage(await getSetting('language'))
  const now = new Date()
  await db.folders.bulkAdd(
    BUILT_IN_FOLDER_KEYS.map((key, index) => ({
      name: i18n.t(key, { lng: lang }),
      order: index,
      createdAt: now,
    })),
  )
  await setUIState(BUILT_IN_SEED_KEY, true)
  window.dispatchEvent(new CustomEvent('folders-changed'))
}

export async function getAllFolders() {
  return db.folders.orderBy('order').toArray()
}

export async function getFolder(id) {
  return db.folders.get(id)
}

export async function createFolder(name) {
  const trimmed = name.trim()
  if (!trimmed) {
    showToast(i18n.t('common:folders.emptyName'), { type: 'error' })
    throw new Error('Folder name cannot be empty')
  }
  const existing = await db.folders.where('name').equalsIgnoreCase(trimmed).first()
  if (existing) {
    showToast(i18n.t('common:folders.duplicate', { name: trimmed }), { type: 'error' })
    throw new Error('Folder already exists')
  }
  const count = await db.folders.count()
  const now = new Date()
  const id = await db.folders.add({ name: trimmed, order: count, createdAt: now })
  window.dispatchEvent(new CustomEvent('folders-changed'))
  return id
}

export async function updateFolder(id, name) {
  const trimmed = name.trim()
  if (!trimmed) {
    showToast(i18n.t('common:folders.emptyName'), { type: 'error' })
    throw new Error('Folder name cannot be empty')
  }
  const existing = await db.folders.where('name').equalsIgnoreCase(trimmed).first()
  if (existing && existing.id !== id) {
    showToast(i18n.t('common:folders.duplicate', { name: trimmed }), { type: 'error' })
    throw new Error('Folder already exists')
  }
  await db.folders.update(id, { name: trimmed })
  window.dispatchEvent(new CustomEvent('folders-changed'))
}

export async function reorderFolders(orderedIds) {
  await Promise.all(orderedIds.map((id, index) => db.folders.update(id, { order: index })))
  window.dispatchEvent(new CustomEvent('folders-changed'))
}

export async function deleteFolder(id) {
  const folder = await db.folders.get(id)
  if (!folder) return
  const charactersInFolder = await db.characters.where('folderId').equals(id).toArray()
  await Promise.all(charactersInFolder.map((c) => db.characters.update(c.id, { folderId: null })))
  await db.folders.delete(id)
  window.dispatchEvent(new CustomEvent('folders-changed'))
  window.dispatchEvent(new CustomEvent('characters-changed', { detail: { action: 'update' } }))
}

export async function getFolderCharacterCounts() {
  const folders = await db.folders.toArray()
  const counts = new Map()
  for (const folder of folders) {
    const count = await db.characters.where('folderId').equals(folder.id).count()
    counts.set(folder.id, count)
  }
  return counts
}
