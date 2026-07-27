import { createLorebook, getAllLorebooks } from './lorebooks'
import { createEntry, getEntriesForLorebook } from './lorebookEntries'
import { mapLorebookFromST } from './lorebookImportExport'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const LOREBOOK_SIGNIFICANT_FIELDS = [
  'name',
  'description',
  'scanDepth',
  'tokenBudget',
  'recursiveScanning',
]
const ENTRY_SIGNIFICANT_FIELDS = [
  'name',
  'keys',
  'secondaryKeys',
  'secondaryLogic',
  'content',
  'constant',
  'enabled',
  'position',
  'insertionOrder',
  'depth',
  'probability',
  'caseSensitive',
  'excludeRecursion',
]

function isEmpty(value) {
  if (value == null) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

function isPngBuffer(uint8) {
  return PNG_SIGNATURE.every((byte, i) => uint8[i] === byte)
}

function readPngChunks(arrayBuffer) {
  const view = new DataView(arrayBuffer)
  const uint8 = new Uint8Array(arrayBuffer)
  if (!isPngBuffer(uint8)) return []

  const chunks = []
  let offset = 8
  while (offset + 12 <= arrayBuffer.byteLength) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(
      uint8[offset + 4],
      uint8[offset + 5],
      uint8[offset + 6],
      uint8[offset + 7],
    )
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd > arrayBuffer.byteLength) break

    chunks.push({ type, data: uint8.slice(dataStart, dataEnd) })

    if (type === 'IEND') break
    offset = dataEnd + 4
  }
  return chunks
}

function findCharaBase64(chunks) {
  for (const chunk of chunks) {
    if (chunk.type === 'tEXt') {
      const nullIdx = chunk.data.indexOf(0)
      if (nullIdx === -1) continue
      const keyword = String.fromCharCode(...chunk.data.slice(0, nullIdx))
      if (keyword === 'chara') {
        return String.fromCharCode(...chunk.data.slice(nullIdx + 1))
      }
    } else if (chunk.type === 'zTXt') {
      const nullIdx = chunk.data.indexOf(0)
      if (nullIdx === -1) continue
      const keyword = String.fromCharCode(...chunk.data.slice(0, nullIdx))
      if (keyword === 'chara') {
        const compressionMethod = chunk.data[nullIdx + 1]
        if (compressionMethod !== 0) continue
        const compressed = chunk.data.slice(nullIdx + 2)
        return { compressed, keyword }
      }
    }
  }
  return null
}

async function decompressZlib(uint8) {
  const ds = new DecompressionStream('deflate-raw')
  const writer = ds.writable.getWriter()
  const reader = ds.readable.getReader()
  writer.write(uint8)
  writer.close()
  const chunks = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

export async function extractCardFromPng(arrayBuffer) {
  const chunks = readPngChunks(arrayBuffer)
  if (chunks.length === 0) {
    throw new Error('Not a valid PNG file')
  }

  const found = findCharaBase64(chunks)
  if (!found) {
    throw new Error('PNG does not contain character card data (no "chara" text chunk)')
  }

  let base64Text
  if (typeof found === 'string') {
    base64Text = found
  } else {
    const decompressed = await decompressZlib(found.compressed)
    base64Text = new TextDecoder().decode(decompressed)
  }

  const jsonStr = atob(base64Text)
  try {
    return JSON.parse(jsonStr)
  } catch {
    throw new Error('Failed to parse character card JSON from PNG metadata')
  }
}

export function detectCardFormat(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('Unsupported character card format')
  }
  if (json.spec === 'chara_card_v2' && json.data) {
    return 'v2'
  }
  if (json.name && (json.description !== undefined || json.first_mes !== undefined)) {
    return 'v1'
  }
  if (
    json.prompt !== undefined ||
    json.initialMessages !== undefined ||
    json.systemPrompt !== undefined
  ) {
    return 'scenara'
  }
  throw new Error('Unsupported character card format')
}

function parseMesExample(mesExample) {
  if (isEmpty(mesExample)) return []
  return mesExample
    .split('<START>')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((content) => ({ id: crypto.randomUUID(), content }))
}

function buildInitialMessages(firstMes, alternateGreetings) {
  const messages = []
  if (!isEmpty(firstMes)) {
    messages.push({ id: crypto.randomUUID(), content: firstMes })
  }
  if (Array.isArray(alternateGreetings)) {
    for (const greeting of alternateGreetings) {
      if (!isEmpty(greeting)) {
        messages.push({ id: crypto.randomUUID(), content: greeting })
      }
    }
  }
  return messages
}

function buildScenarios(scenario) {
  if (isEmpty(scenario)) return []
  return [
    {
      id: crypto.randomUUID(),
      name: '',
      content: scenario,
      lifetime: 'always',
      active: true,
    },
  ]
}

export function mapV2ToScenara(cardJson) {
  const data = cardJson.data || {}
  const result = {}

  if (!isEmpty(data.name)) result.name = data.name
  if (!isEmpty(data.description)) result.prompt = data.description
  if (!isEmpty(data.personality)) result.personality = data.personality
  if (!isEmpty(data.system_prompt)) result.systemPrompt = data.system_prompt
  if (!isEmpty(data.post_history_instructions))
    result.postHistoryInstructions = data.post_history_instructions
  if (!isEmpty(data.avatar)) result.avatar = data.avatar
  if (!isEmpty(data.creator)) result.creator = data.creator
  if (!isEmpty(data.character_version)) result.characterVersion = data.character_version
  if (!isEmpty(data.creator_notes)) result.creatorNotes = data.creator_notes

  const initialMessages = buildInitialMessages(data.first_mes, data.alternate_greetings)
  if (initialMessages.length > 0) result.initialMessages = initialMessages

  const exampleMessages = parseMesExample(data.mes_example)
  if (exampleMessages.length > 0) result.exampleMessages = exampleMessages

  const scenarios = buildScenarios(data.scenario)
  if (scenarios.length > 0) result.scenarios = scenarios

  if (Array.isArray(data.tags) && data.tags.length > 0) {
    result.tags = data.tags
  }

  return result
}

export function mapV1ToScenara(json) {
  const result = {}

  if (!isEmpty(json.name)) result.name = json.name
  if (!isEmpty(json.description)) result.prompt = json.description
  if (!isEmpty(json.personality)) result.personality = json.personality

  const initialMessages = buildInitialMessages(json.first_mes, null)
  if (initialMessages.length > 0) result.initialMessages = initialMessages

  const exampleMessages = parseMesExample(json.mes_example)
  if (exampleMessages.length > 0) result.exampleMessages = exampleMessages

  const scenarios = buildScenarios(json.scenario)
  if (scenarios.length > 0) result.scenarios = scenarios

  return result
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function entryMatchesExisting(existing, incoming) {
  for (const field of ENTRY_SIGNIFICANT_FIELDS) {
    const a = existing[field]
    const b = incoming[field]
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!arraysEqual(a, b)) return false
    } else if (a !== b) {
      return false
    }
  }
  return true
}

async function lorebookMatchesExisting(existingLorebook, incomingLorebook, incomingEntries) {
  for (const field of LOREBOOK_SIGNIFICANT_FIELDS) {
    if (existingLorebook[field] !== incomingLorebook[field]) return false
  }

  const existingEntries = await getEntriesForLorebook(existingLorebook.id)
  if (existingEntries.length !== incomingEntries.length) return false

  const sortedExisting = [...existingEntries].sort((a, b) =>
    (a.name || '').localeCompare(b.name || ''),
  )
  const sortedIncoming = [...incomingEntries].sort((a, b) =>
    (a.name || '').localeCompare(b.name || ''),
  )

  for (let i = 0; i < sortedExisting.length; i++) {
    if (!entryMatchesExisting(sortedExisting[i], sortedIncoming[i])) return false
  }

  return true
}

export async function handleCharacterBook(characterBook) {
  if (!characterBook || typeof characterBook !== 'object') return null
  if (!Array.isArray(characterBook.entries) || characterBook.entries.length === 0) return null

  const mapped = mapLorebookFromST(characterBook)
  if (!mapped) return null

  const { lorebook, entries } = mapped
  lorebook.isGlobal = false

  const allExisting = await getAllLorebooks()
  for (const existing of allExisting) {
    if (await lorebookMatchesExisting(existing, lorebook, entries)) {
      return existing.id
    }
  }

  const lorebookId = await createLorebook(lorebook)
  for (const entry of entries) {
    await createEntry(lorebookId, entry)
  }
  return lorebookId
}

export async function importCharacterCard(input) {
  let json
  if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
    const buf = input instanceof Uint8Array ? input.buffer : input
    const uint8 = new Uint8Array(buf)
    const isPng = uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4e && uint8[3] === 0x47
    if (isPng) {
      json = await extractCardFromPng(buf)
    } else {
      json = JSON.parse(new TextDecoder().decode(uint8))
    }
  } else {
    json = input
  }

  const format = detectCardFormat(json)
  if (format === 'scenara') return { data: json, format }

  const mapped = format === 'v2' ? mapV2ToScenara(json) : mapV1ToScenara(json)

  const characterBook = format === 'v2' ? json.data?.character_book : null
  if (characterBook) {
    const lorebookId = await handleCharacterBook(characterBook)
    if (lorebookId) {
      mapped.lorebookIds = [lorebookId]
    }
  }

  return { data: mapped, format }
}
