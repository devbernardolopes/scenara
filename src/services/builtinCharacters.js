import db from '../db'
import { getSetting, setSetting } from './settings'
import { getNextCharacterNumber } from './characters'
import { resolveInlineEntities } from './characterCardImport'

const SEEDED_FLAG = 'builtInCharactersSeeded'

// Every JSON file in src/builtins/characters/ is a built-in character.
// Files are bundled at build time, so adding/removing/editing them only
// requires touching the JSON and redeploying.
const builtInModules = import.meta.glob('../builtins/characters/*.json', {
  eager: true,
  import: 'default',
})

export function loadBuiltInCharacters() {
  return Object.values(builtInModules)
    .filter((c) => c && typeof c.name === 'string' && c.name.trim())
    .sort((a, b) => a.name.localeCompare(b.name))
}

let seedingPromise = null

export function ensureBuiltInCharacters() {
  if (!seedingPromise) {
    seedingPromise = seedBuiltInCharacters().finally(() => {
      seedingPromise = null
    })
  }
  return seedingPromise
}

async function seedBuiltInCharacters() {
  if (await getSetting(SEEDED_FLAG)) return
  const count = await db.characters.count()
  if (count > 0) {
    await setSetting(SEEDED_FLAG, true)
    return
  }

  const builtIns = loadBuiltInCharacters()
  for (const builtIn of builtIns) {
    const resolved = await resolveInlineEntities(builtIn)
    const now = new Date()
    const characterNumber = await getNextCharacterNumber()
    await db.characters.add({ ...resolved, characterNumber, createdAt: now, updatedAt: now })
  }

  await setSetting(SEEDED_FLAG, true)
  window.dispatchEvent(new CustomEvent('characters-changed', { detail: { action: 'seed' } }))
}
