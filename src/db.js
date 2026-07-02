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

export default db
