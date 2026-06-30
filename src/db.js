import Dexie from 'dexie'

const db = new Dexie('scenara')

db.version(1).stores({
  threads: '++id, title, characterId, updatedAt',
  characters: '++id, name, createdAt',
  personas: '++id, name, createdAt',
  settings: '++id, key',
})

export default db
