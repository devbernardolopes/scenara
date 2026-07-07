import Dexie from 'dexie'

const db = new Dexie('scenara')

db.version(1).stores({
  threads: '++id, title, characterId, updatedAt',
  characters: '++id, name, createdAt',
  personas: '++id, name, createdAt',
  settings: '++id, key',
  uiState: '++id, key',
})

db.version(2).stores({
  threads: '++id, title, characterId, updatedAt',
  characters: '++id, name, createdAt',
  personas: '++id, name, createdAt',
  settings: '++id, key',
  uiState: '++id, key',
  messages: '++id, threadId, role, createdAt',
})

db.version(3).stores({
  threads: '++id, title, characterId, personaId, updatedAt',
  characters: '++id, name, createdAt',
  personas: '++id, name, title, createdAt, isDefault',
  settings: '++id, key',
  uiState: '++id, key',
  messages: '++id, threadId, role, createdAt',
})

db.version(4).stores({
  threads: '++id, title, characterId, personaId, updatedAt, isFavorite, threadNumber',
  characters: '++id, name, createdAt',
  personas: '++id, name, title, createdAt, isDefault',
  settings: '++id, key',
  uiState: '++id, key',
  messages: '++id, threadId, role, createdAt',
})

db.version(5).stores({
  threads: '++id, title, characterId, personaId, updatedAt, isFavorite, threadNumber',
  characters: '++id, name, createdAt',
  personas: '++id, name, title, createdAt, isDefault',
  settings: '++id, key',
  uiState: '++id, key',
  messages: '++id, threadId, role, createdAt',
  writingInstructions: '++id, name, createdAt',
})

db.version(6)
  .stores({
    threads: '++id, title, characterId, personaId, updatedAt, isFavorite, threadNumber',
    characters: '++id, name, createdAt, updatedAt, characterNumber',
    personas: '++id, name, title, createdAt, isDefault',
    settings: '++id, key',
    uiState: '++id, key',
    messages: '++id, threadId, role, createdAt',
    writingInstructions: '++id, name, createdAt',
  })
  .upgrade(async (tx) => {
    const chars = await tx.table('characters').toArray()
    const maxNum = chars.reduce((m, c) => Math.max(m, c.characterNumber || c.id || 0), 0)
    await tx.table('settings').add({ key: 'characterCounter', value: maxNum })
  })

db.version(7).stores({
  threads: '++id, title, characterId, personaId, updatedAt, isFavorite, threadNumber',
  characters: '++id, name, createdAt, updatedAt, characterNumber',
  personas: '++id, name, title, createdAt, isDefault',
  settings: '++id, key',
  uiState: '++id, key',
  messages: '++id, threadId, role, createdAt',
  writingInstructions: '++id, name, createdAt',
  connectionProfiles: '++id, name, createdAt',
})

db.version(8).stores({
  threads: '++id, title, characterId, personaId, updatedAt, isFavorite, threadNumber',
  characters: '++id, name, createdAt, updatedAt, characterNumber',
  personas: '++id, name, title, createdAt, isDefault',
  settings: '++id, key',
  uiState: '++id, key',
  messages: '++id, threadId, role, createdAt',
  writingInstructions: '++id, name, createdAt',
  connectionProfiles: '++id, name, createdAt',
  inChatShortcuts: '++id, name, createdAt',
})

db.version(9).stores({
  threads: '++id, title, characterId, personaId, updatedAt, isFavorite, threadNumber',
  characters: '++id, name, createdAt, updatedAt, characterNumber',
  personas: '++id, name, title, createdAt, isDefault',
  settings: '++id, key',
  uiState: '++id, key',
  messages: '++id, threadId, role, personaId, createdAt',
  writingInstructions: '++id, name, createdAt',
  connectionProfiles: '++id, name, createdAt',
  inChatShortcuts: '++id, name, createdAt',
})

db.version(10).stores({
  threads: '++id, title, characterId, personaId, updatedAt, isFavorite, threadNumber',
  characters: '++id, name, createdAt, updatedAt, characterNumber',
  personas: '++id, name, title, createdAt, isDefault',
  settings: '++id, key',
  uiState: '++id, key',
  messages: '++id, threadId, role, personaId, createdAt',
  writingInstructions: '++id, name, createdAt',
  connectionProfiles: '++id, name, createdAt',
  inChatShortcuts: '++id, name, createdAt',
  promptHistory: '++id, threadId, createdAt',
})

db.version(11).stores({
  threads: '++id, title, characterId, personaId, updatedAt, isFavorite, threadNumber',
  characters: '++id, name, createdAt, updatedAt, characterNumber, *tags',
  personas: '++id, name, title, createdAt, isDefault',
  settings: '++id, key',
  uiState: '++id, key',
  messages: '++id, threadId, role, personaId, createdAt',
  writingInstructions: '++id, name, createdAt',
  connectionProfiles: '++id, name, createdAt',
  inChatShortcuts: '++id, name, createdAt',
  promptHistory: '++id, threadId, createdAt',
  tags: '++id, &name, createdAt',
})

db.version(12).stores({
  threads: '++id, title, characterId, personaId, updatedAt, isFavorite, threadNumber',
  characters: '++id, name, createdAt, updatedAt, characterNumber, *tags',
  personas: '++id, name, title, createdAt, isDefault',
  settings: '++id, key',
  uiState: '++id, key',
  messages: '++id, threadId, role, personaId, createdAt, summarizedAt',
  writingInstructions: '++id, name, createdAt',
  connectionProfiles: '++id, name, createdAt',
  inChatShortcuts: '++id, name, createdAt',
  promptHistory: '++id, threadId, createdAt',
  tags: '++id, &name, createdAt',
})

db.version(13).stores({
  threads: '++id, title, characterId, personaId, updatedAt, isFavorite, threadNumber',
  characters: '++id, name, createdAt, updatedAt, characterNumber, *tags',
  personas: '++id, name, title, createdAt, isDefault',
  settings: '++id, key',
  uiState: '++id, key',
  messages: '++id, threadId, role, personaId, createdAt, summarizedAt',
  writingInstructions: '++id, name, createdAt',
  connectionProfiles: '++id, name, createdAt',
  inChatShortcuts: '++id, name, createdAt',
  promptHistory: '++id, threadId, createdAt',
  tags: '++id, &name, createdAt',
  threadMemories: '++id, threadId, createdAt',
})

export default db
