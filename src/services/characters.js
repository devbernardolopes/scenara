import db from '../db'
import { showToast } from '../lib/toast'
import i18n from '../lib/i18n'
import { deleteUIStateByKeyPrefix } from './uiState'
import { importCharacterCard } from './characterCardImport'
import { ensureBuiltInCharacters } from './builtinCharacters'
import { getLorebook } from './lorebooks'
import { getEntriesForLorebook } from './lorebookEntries'
import { getWritingInstruction } from './writingInstructions'

export async function getAllCharacters() {
  await ensureBuiltInCharacters()
  return db.characters.orderBy('createdAt').toArray()
}

export async function getCharacter(id) {
  return db.characters.get(id)
}

export async function getNextCharacterNumber() {
  return db.transaction('rw', [db.settings, db.characters], async () => {
    const row = await db.settings.where('key').equals('characterCounter').first()
    if (row) {
      const next = row.value + 1
      await db.settings.update(row.id, { value: next })
      return next
    }
    const all = await db.characters.toArray()
    const max = all.reduce((m, c) => Math.max(m, c.characterNumber || 0), 0)
    const next = max + 1
    await db.settings.add({ key: 'characterCounter', value: next })
    return next
  })
}

export async function getCharacterChatCounts() {
  const threads = await db.threads.toArray()
  const counts = new Map()
  for (const t of threads) {
    counts.set(t.characterId, (counts.get(t.characterId) || 0) + 1)
  }
  return counts
}

export async function touchCharacterLastUsed(characterId) {
  const now = new Date()
  await db.characters.update(characterId, { lastUsedAt: now })
}

export async function createCharacter(data) {
  const now = new Date()
  const characterNumber = await getNextCharacterNumber()
  const id = await db.characters.add({
    ...data,
    characterNumber,
    createdAt: now,
    updatedAt: now,
  })
  window.dispatchEvent(
    new CustomEvent('characters-changed', {
      detail: { action: 'create', entityName: data.name },
    }),
  )
  return id
}

export async function updateCharacter(id, data) {
  const character = await db.characters.get(id)
  const updated = await db.characters.update(id, { ...data, updatedAt: new Date() })
  if (updated) {
    const action = 'isFavorite' in data ? (data.isFavorite ? 'favorite' : 'unfavorite') : 'update'
    window.dispatchEvent(
      new CustomEvent('characters-changed', {
        detail: { action, entityName: data.name || character?.name },
      }),
    )
    return id
  }
  throw new Error('Character not found')
}

export async function assignCharacterFolder(id, folderId) {
  const character = await db.characters.get(id)
  const updated = await db.characters.update(id, { folderId })
  if (updated) {
    window.dispatchEvent(
      new CustomEvent('characters-changed', {
        detail: { action: 'folder', entityName: character?.name },
      }),
    )
    return id
  }
  throw new Error('Character not found')
}

export async function updateCharacterLastSection(id, section) {
  await db.characters.update(id, { lastSection: section })
}

export async function deleteCharacter(id) {
  const character = await db.characters.get(id)
  await db.characters.delete(id)
  window.dispatchEvent(
    new CustomEvent('characters-changed', {
      detail: { action: 'delete', entityName: character?.name || 'Unknown' },
    }),
  )
}

const COLLAPSIBLE_PREFIXES = [
  'charSection.prompt.',
  'charSection.extraPrompt.',
  'charSection.postHistoryInstructions.',
  'charSection.autoTitleSystem.',
  'charSection.autoTitleUser.',
  'charSection.summarizationSystem.',
  'charSection.summarizationUser.',
]

async function cleanupCollapsibleState(characterId) {
  await Promise.all(
    COLLAPSIBLE_PREFIXES.map((prefix) =>
      deleteUIStateByKeyPrefix(`collapsed.${prefix}${characterId}`),
    ),
  )
}

export async function deleteCharacterWithThreads(id) {
  const character = await db.characters.get(id)
  if (!character) throw new Error('Character not found')
  const threads = await db.threads.where('characterId').equals(id).toArray()
  await Promise.all(
    threads.map((t) =>
      db.messages
        .where('threadId')
        .equals(t.id)
        .delete()
        .then(() => db.threads.delete(t.id)),
    ),
  )
  await db.characters.delete(id)
  await cleanupCollapsibleState(id)
  window.dispatchEvent(
    new CustomEvent('characters-changed', {
      detail: { action: 'delete', entityName: character.name, count: 1 + threads.length },
    }),
  )
  window.dispatchEvent(new CustomEvent('threads-changed'))
}

export async function duplicateCharacter(id) {
  const original = await db.characters.get(id)
  if (!original) throw new Error('Character not found')
  const now = new Date()
  const characterNumber = await getNextCharacterNumber()
  const { id: _id, createdAt: _ca, updatedAt: _ua, characterNumber: _cn, ...rest } = original
  const newId = await db.characters.add({
    ...rest,
    name: original.name,
    displayName: original.displayName
      ? `${original.displayName} (Copy)`
      : `${original.name} (Copy)`,
    characterNumber,
    createdAt: now,
    updatedAt: now,
  })
  window.dispatchEvent(
    new CustomEvent('characters-changed', {
      detail: { action: 'duplicate', entityName: original.name },
    }),
  )
  return newId
}

export async function exportCharacter(id) {
  const c = await db.characters.get(id)
  if (!c) {
    showToast(i18n.t('common:toast.export.invalidItem'), { type: 'error' })
    throw new Error('Character not found')
  }
  const { id: _id, createdAt: _ca, updatedAt: _ua, folderId: _fid, ...data } = c
  if (data.tags?.length) {
    const tagObjs = await Promise.all(data.tags.map((tid) => db.tags.get(tid)))
    data.tags = tagObjs.filter(Boolean).map((t) => t.name)
  }
  if (data.writingInstruction) {
    const wi = await getWritingInstruction(data.writingInstruction)
    data.writingInstruction = wi ? { name: wi.name, content: wi.content } : null
  }
  if (data.lorebookIds?.length) {
    data.lorebooks = await Promise.all(
      data.lorebookIds.map(async (lid) => {
        const l = await getLorebook(lid)
        if (!l) return null
        const entries = await getEntriesForLorebook(lid)
        return {
          name: l.name,
          avatar: l.avatar || '',
          description: l.description || '',
          scanDepth: l.scanDepth ?? null,
          tokenBudget: l.tokenBudget ?? null,
          recursiveScanning: Boolean(l.recursiveScanning),
          entries: entries.map((e) => {
            const { id: _eid, lorebookId: _lid, createdAt: _eca, updatedAt: _eua, ...entryData } = e
            return entryData
          }),
        }
      }),
    )
    data.lorebooks = data.lorebooks.filter(Boolean)
  }
  delete data.lorebookIds
  showToast(i18n.t('common:toast.character.exported', { name: c.name }), { type: 'success' })
  return data
}

export function importCharacterFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const result = await importCharacterCard(e.target.result)
        resolve(result.data)
      } catch {
        reject(new Error(i18n.t('common:toast.import.invalidFormat')))
      }
    }
    reader.onerror = () => reject(new Error(i18n.t('common:toast.import.fileError')))
    reader.readAsArrayBuffer(file)
  })
}
