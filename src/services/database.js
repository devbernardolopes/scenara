import db from '../db'
import { SETTINGS, applySettingEffect } from './settings'
import { getUIState } from './uiState'

export async function exportDatabase(selection) {
  const data = {
    exportDate: new Date().toISOString(),
    version: 1,
  }

  if (selection.tags) {
    data.tags = await db.tags.toArray()
  }

  if (selection.characterIds?.size > 0) {
    const characters = await db.characters.toArray()
    const filtered = characters.filter((c) => selection.characterIds.has(c.id))
    data.characters = await Promise.all(
      filtered.map(async (c) => {
        if (c.tags?.length) {
          const tagObjs = await Promise.all(c.tags.map((tid) => db.tags.get(tid)))
          return { ...c, tags: tagObjs.filter(Boolean).map((t) => t.name) }
        }
        return c
      }),
    )
  }

  if (selection.personaIds?.size > 0) {
    const personas = await db.personas.toArray()
    const filtered = personas.filter((p) => selection.personaIds.has(p.id))
    data.personas = [...filtered]
  }

  if (selection.writingInstructionIds?.size > 0) {
    const items = await db.writingInstructions.toArray()
    const filtered = items.filter((w) => selection.writingInstructionIds.has(w.id))
    data.writingInstructions = [...filtered]
  }

  if (selection.connectionProfileIds?.size > 0) {
    const profiles = await db.connectionProfiles.toArray()
    const filtered = profiles.filter((p) => selection.connectionProfileIds.has(p.id))
    data.connectionProfiles = [...filtered]
  }

  if (selection.logIds?.size > 0) {
    const allLogs = await db.logs.toArray()
    const filtered = allLogs.filter((l) => selection.logIds.has(l.id))
    data.logs = [...filtered]
  }

  if (selection.inChatShortcutIds?.size > 0) {
    const items = await db.inChatShortcuts.toArray()
    const filtered = items.filter((i) => selection.inChatShortcutIds.has(i.id))
    data.inChatShortcuts = [...filtered]
  }

  if (selection.settings) {
    data.settings = await db.settings.toArray()
  }

  // Discovery filter & sorting state is stored in uiState. Include it so the
  // main/discovery view restores the same Filter & Sorting after import.
  const discoverySortBy = await getUIState('discovery.sortBy')
  const discoverySortOrder = await getUIState('discovery.sortOrder')
  const discoverySearchQuery = await getUIState('discovery.searchQuery')
  if (discoverySortBy != null || discoverySortOrder != null || discoverySearchQuery != null) {
    data.discoveryView = {
      sortBy: discoverySortBy,
      sortOrder: discoverySortOrder,
      searchQuery: discoverySearchQuery,
    }
  }

  const threadIds = new Set(selection.threadIds || [])

  if (selection.characterIds?.size > 0) {
    const allThreads = await db.threads.toArray()
    for (const thr of allThreads) {
      if (selection.characterIds.has(thr.characterId)) {
        threadIds.add(thr.id)
      }
    }
  }

  if (threadIds.size > 0) {
    const allThreads = await db.threads.toArray()
    data.threads = allThreads.filter((t) => threadIds.has(t.id))

    const allMessages = await db.messages.toArray()
    data.messages = allMessages.filter((m) => threadIds.has(m.threadId))

    const allPh = await db.promptHistory.toArray()
    data.promptHistory = allPh.filter((p) => threadIds.has(p.threadId))

    const allTm = await db.threadMemories.toArray()
    data.threadMemories = allTm.filter((tm) => threadIds.has(tm.threadId))
  }

  return data
}

export async function importDatabase(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data')
  }

  const hasEntities =
    Array.isArray(data.characters) ||
    Array.isArray(data.personas) ||
    Array.isArray(data.threads) ||
    Array.isArray(data.settings)

  if (!hasEntities) {
    throw new Error('Invalid file')
  }

  const tablesToClear = [
    'threads',
    'characters',
    'personas',
    'settings',
    'messages',
    'writingInstructions',
    'connectionProfiles',
    'inChatShortcuts',
    'promptHistory',
    'tags',
    'threadMemories',
    'logs',
  ]

  function addWithId(table, record) {
    const { id: oldId, ...rest } = record
    if (oldId != null) {
      return table.add({ id: oldId, ...rest })
    }
    return table.add(rest)
  }

  await db.transaction('rw', [...tablesToClear.map((t) => db[t]), db.uiState], async () => {
    for (const table of tablesToClear) {
      await db[table].clear()
    }

    const tagIdMap = {}

    if (Array.isArray(data.tags)) {
      for (const tag of data.tags) {
        const { id: oldId, ...tagData } = tag
        const addData = oldId != null ? { id: oldId, ...tagData } : tagData
        const newId = await db.tags.add(addData)
        if (tag.name) tagIdMap[tag.name] = newId
      }
    }

    if (Array.isArray(data.personas)) {
      for (const persona of data.personas) {
        await addWithId(db.personas, persona)
      }
    }

    if (Array.isArray(data.characters)) {
      for (const character of data.characters) {
        const { id: oldId, tags: tagNames, ...characterData } = character
        if (Array.isArray(tagNames) && tagNames.length > 0) {
          const resolvedTags = tagNames.map((name) => tagIdMap[name]).filter(Boolean)
          if (resolvedTags.length > 0) {
            characterData.tags = resolvedTags
          }
        }
        if (oldId != null) {
          await db.characters.add({ id: oldId, ...characterData })
        } else {
          await db.characters.add(characterData)
        }
      }
    }

    if (Array.isArray(data.threads)) {
      for (const thread of data.threads) {
        await addWithId(db.threads, thread)
      }
    }

    if (Array.isArray(data.writingInstructions)) {
      for (const item of data.writingInstructions) {
        await addWithId(db.writingInstructions, item)
      }
    }

    if (Array.isArray(data.connectionProfiles)) {
      for (const profile of data.connectionProfiles) {
        await addWithId(db.connectionProfiles, profile)
      }
    }

    if (Array.isArray(data.inChatShortcuts)) {
      for (const item of data.inChatShortcuts) {
        await addWithId(db.inChatShortcuts, item)
      }
    }

    if (Array.isArray(data.settings)) {
      for (const setting of data.settings) {
        await addWithId(db.settings, setting)
      }
    }

    if (Array.isArray(data.messages)) {
      for (const message of data.messages) {
        await addWithId(db.messages, message)
      }
    }

    if (Array.isArray(data.promptHistory)) {
      for (const item of data.promptHistory) {
        await addWithId(db.promptHistory, item)
      }
    }

    if (Array.isArray(data.threadMemories)) {
      for (const item of data.threadMemories) {
        await addWithId(db.threadMemories, item)
      }
    }

    if (Array.isArray(data.logs)) {
      for (const item of data.logs) {
        await addWithId(db.logs, item)
      }
    }

    if (data.discoveryView && typeof data.discoveryView === 'object') {
      await db.uiState.where('key').startsWith('discovery.').delete()
      if (data.discoveryView.sortBy != null) {
        await db.uiState.add({ key: 'discovery.sortBy', value: data.discoveryView.sortBy })
      }
      if (data.discoveryView.sortOrder != null) {
        await db.uiState.add({
          key: 'discovery.sortOrder',
          value: data.discoveryView.sortOrder,
        })
      }
      if (data.discoveryView.searchQuery != null) {
        await db.uiState.add({
          key: 'discovery.searchQuery',
          value: data.discoveryView.searchQuery,
        })
      }
    }
  })

  return true
}

export async function resetSettings() {
  const allSettings = await db.settings.toArray()
  const apiKeyEntries = allSettings.filter((s) => /^api\.\w+\.keys$/.test(s.key))

  await db.settings.clear()

  for (const setting of SETTINGS) {
    await db.settings.add({ key: setting.key, value: setting.default })
  }
  await db.settings.bulkAdd(apiKeyEntries)

  applySettingEffect('theme', SETTINGS.find((s) => s.key === 'theme').default)
  applySettingEffect('language', SETTINGS.find((s) => s.key === 'language').default)

  window.dispatchEvent(new CustomEvent('settings-changed', { detail: { action: 'reset' } }))
}

export async function resetDatabase() {
  await db.threads.clear()
  await db.characters.clear()
  await db.personas.clear()
  await db.settings.clear()
  await db.uiState.clear()
  await db.messages.clear()
  await db.writingInstructions.clear()
  await db.connectionProfiles.clear()
  await db.inChatShortcuts.clear()
  await db.promptHistory.clear()
  await db.tags.clear()
  await db.threadMemories.clear()

  for (const setting of SETTINGS) {
    await db.settings.add({ key: setting.key, value: setting.default })
  }

  applySettingEffect('theme', SETTINGS.find((s) => s.key === 'theme').default)
  applySettingEffect('language', SETTINGS.find((s) => s.key === 'language').default)

  const now = new Date()
  const personaId = await db.personas.add({
    name: 'Anon',
    title: '',
    avatar: '',
    description: '',
    context: '',
    color: '',
    isDefault: 1,
    createdAt: now,
    updatedAt: now,
  })

  await db.settings.add({ key: 'defaultPersonaId', value: personaId })

  window.dispatchEvent(new CustomEvent('settings-changed', { detail: { key: 'defaultPersonaId' } }))
  window.dispatchEvent(new CustomEvent('personas-changed', { detail: { action: 'reset' } }))
  window.dispatchEvent(new CustomEvent('characters-changed', { detail: { action: 'reset' } }))
  window.dispatchEvent(new CustomEvent('threads-changed', { detail: { action: 'reset' } }))
  window.dispatchEvent(
    new CustomEvent('writingInstructions-changed', { detail: { action: 'reset' } }),
  )
  window.dispatchEvent(
    new CustomEvent('connectionProfiles-changed', { detail: { action: 'reset' } }),
  )
  window.dispatchEvent(new CustomEvent('inChatShortcuts-changed', { detail: { action: 'reset' } }))
}
