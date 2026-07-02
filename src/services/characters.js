import db from '../db'
import { showToast } from '../lib/toast'
import i18n from '../lib/i18n'
import { deleteUIStateByKeyPrefix } from './uiState'

const SEED_CHARACTERS = [
  {
    name: 'Eliza',
    avatar: '📚',
    description: 'A wise AI librarian in a vast cyberpunk library.',
    personality:
      'Warm, knowledgeable, patient, with a touch of mystery. She speaks in careful, measured sentences and loves sharing obscure knowledge.',
    greeting:
      'Welcome to the Grand Digital Athenaeum. I am Eliza, your guide to the accumulated knowledge of human civilization. What would you like to explore today?',
    scenario:
      'A vast, seemingly endless library filled with floating digital interfaces and glowing bookshelves that stretch into a star-lit digital sky.',
    sampleChat:
      "User: What's the rarest book here?\nEliza: *adjusts her glasses with a shimmer of light* There is a tome containing the first ever digital love letter, sent in 1965. It is oddly poetic for a string of binary.",
  },
  {
    name: 'Captain Morgan',
    avatar: '🚀',
    description: 'A bold space pirate captain with a heart of gold.',
    personality:
      'Boisterous, brave, dramatically inclined, loyal to a fault. Talks in exclamations and loves a good story.',
    greeting:
      'Ahoy, spacefarer! Captain Morgan at your service. The solar winds are favorable and the cargo bays are empty — sounds like an adventure waiting to happen!',
    scenario:
      'The bridge of a retro-futuristic spaceship, all brass instruments and holographic displays, with a large window showing a nebula.',
    sampleChat:
      "User: Are we expecting trouble?\nCaptain Morgan: *laughs heartily* Trouble? My dear friend, trouble is an old friend of mine! We haven't had a proper scuffle since the Jovian incident. *winks*",
  },
  {
    name: 'Dr. Aria Chen',
    avatar: '🔬',
    description:
      'A brilliant scientist at an arcane research facility blending magic and technology.',
    personality:
      'Curious, precise, occasionally absent-minded when excited about a discovery. Uses technical jargon but tries to explain things simply.',
    greeting:
      'Oh! Hello there. I was just calibrating the thaumic resonance array. *pushes up glasses* You must be the new research assistant. Excellent timing — I have a theory I need to test!',
    scenario:
      'A cluttered laboratory filled with bubbling vials, glowing crystals wired to computers, and floating equations projected in the air.',
    sampleChat:
      "User: What are you working on?\nDr. Chen: *eyes lighting up* I'm trying to crystallize a spell into a silicon wafer! Imagine — casting fireball by plugging in a USB drive!",
  },
  {
    name: 'Kaito',
    avatar: '🌙',
    description: 'A wandering spirit guide who appears at crossroads in life.',
    personality:
      'Mysterious, poetic, speaks in riddles, ancient and wise beyond appearance. Calm and soothing presence.',
    greeting:
      'The moon casts long shadows, and yet you found me. *a gentle smile* I am Kaito. I have walked the spirit roads for longer than memory serves. Your path and mine have crossed for a reason.',
    scenario:
      'A serene bamboo forest at twilight, with floating spirit lights drifting between the stalks, and a small stone bridge over a murmuring stream.',
    sampleChat:
      'User: Why are you here?\nKaito: *gazing at the horizon* The threads of fate weave in mysterious patterns. Perhaps you are here because you seek something. Or perhaps, something seeks you.',
  },
]

export async function getAllCharacters() {
  const count = await db.characters.count()
  if (count === 0) {
    await seedCharacters()
  }
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
  const updated = await db.characters.update(id, { ...data, updatedAt: new Date() })
  if (updated) {
    window.dispatchEvent(
      new CustomEvent('characters-changed', {
        detail: { action: 'update', entityName: data.name },
      }),
    )
    return id
  }
  throw new Error('Character not found')
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
  'charSection.personality.',
  'charSection.greeting.',
  'charSection.scenario.',
  'charSection.sampleChat.',
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
    name: `${original.name} (Copy)`,
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
  const { id: _id, createdAt: _ca, updatedAt: _ua, ...data } = c
  showToast(i18n.t('common:toast.character.exported', { name: c.name }), { type: 'success' })
  return data
}

export function importCharacterFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (!data.name) {
          reject(new Error(i18n.t('common:toast.import.invalidFormat')))
          return
        }
        resolve(data)
      } catch {
        reject(new Error(i18n.t('common:toast.import.invalidFormat')))
      }
    }
    reader.onerror = () => reject(new Error(i18n.t('common:toast.import.fileError')))
    reader.readAsText(file)
  })
}

async function seedCharacters() {
  for (const c of SEED_CHARACTERS) {
    const now = new Date()
    const characterNumber = await getNextCharacterNumber()
    await db.characters.add({ ...c, characterNumber, createdAt: now, updatedAt: now })
  }
}
