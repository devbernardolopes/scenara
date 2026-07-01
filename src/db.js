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

export default db
