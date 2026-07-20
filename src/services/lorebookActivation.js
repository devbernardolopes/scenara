import { getLorebook, getAllLorebooks } from './lorebooks'
import { getEntriesForLorebook } from './lorebookEntries'
import { estimateTokens } from './tokenEstimator'

const MAX_RECURSION_HOPS = 2

function matchesKeys(buffer, keys, caseSensitive) {
  if (!keys?.length) return true
  const haystack = caseSensitive ? buffer : buffer.toLowerCase()
  return keys.some((k) => haystack.includes(caseSensitive ? k : k.toLowerCase()))
}

function matchesSecondary(buffer, secondaryKeys, logic, caseSensitive) {
  if (!logic || !secondaryKeys?.length) return true
  const haystack = caseSensitive ? buffer : buffer.toLowerCase()
  const hits = secondaryKeys.filter((k) => haystack.includes(caseSensitive ? k : k.toLowerCase()))
  switch (logic) {
    case 'andAny':
      return hits.length > 0
    case 'andAll':
      return hits.length === secondaryKeys.length
    case 'notAny':
      return hits.length === 0
    case 'notAll':
      return hits.length < secondaryKeys.length
    default:
      return true
  }
}

function matchesCharacterFilter(filter, character) {
  if (!filter) return true
  const name = character?.name
  const tags = character?.tags || []
  const hit = filter.names?.includes(name) || filter.tags?.some((t) => tags.includes(t))
  return filter.isExclude ? !hit : hit
}

function isActivated(entry, buffer, character, rollCache) {
  if (!entry.enabled) return false
  if (entry.constant) return true
  if (!matchesKeys(buffer, entry.keys, entry.caseSensitive)) return false
  if (!matchesSecondary(buffer, entry.secondaryKeys, entry.secondaryLogic, entry.caseSensitive))
    return false
  if (!matchesCharacterFilter(entry.characterFilter, character)) return false
  if (entry.probability != null) {
    let roll = rollCache.get(entry.id)
    if (roll === undefined) {
      roll = Math.random() * 100
      rollCache.set(entry.id, roll)
    }
    if (roll >= entry.probability) return false
  }
  return true
}

function buildScanBuffer(messages, scanDepth) {
  const slice = scanDepth && scanDepth > 0 ? messages.slice(-scanDepth) : messages
  return slice.map((m) => m.content || '').join('\n')
}

async function getActiveLorebooksForCharacter(character) {
  const linked = character?.lorebookIds?.length
    ? await Promise.all(character.lorebookIds.map(getLorebook))
    : []
  const globals = await getAllLorebooks({ isGlobal: true })
  const seen = new Map()
  for (const lb of [...linked, ...globals]) {
    if (lb) seen.set(lb.id, lb)
  }
  return [...seen.values()]
}

async function activateEntries(lorebook, entries, initialBuffer, character, rollCache) {
  let buffer = initialBuffer
  const activated = []
  let hop = 0
  let candidates = entries

  while (hop <= MAX_RECURSION_HOPS) {
    const newlyActivated = candidates.filter((e) => isActivated(e, buffer, character, rollCache))
    const newIds = new Set(newlyActivated.map((e) => e.id))
    const alreadyIds = new Set(activated.map((e) => e.id))
    const trulyNew = newlyActivated.filter((e) => !alreadyIds.has(e.id))
    if (trulyNew.length === 0) break

    activated.push(...trulyNew)

    if (!lorebook.recursiveScanning) break
    const recursionText = trulyNew
      .filter((e) => !e.excludeRecursion)
      .map((e) => e.content)
      .join('\n')
    if (!recursionText) break

    buffer = buffer + '\n' + recursionText
    candidates = entries.filter((e) => !newIds.has(e.id))
    hop += 1
  }

  return activated
}

function trimToTokenBudget(entries, tokenBudget) {
  if (!tokenBudget || tokenBudget <= 0) return entries
  const sorted = [...entries].sort((a, b) => (a.insertionOrder ?? 100) - (b.insertionOrder ?? 100))
  const kept = []
  let tokens = 0
  for (const entry of sorted) {
    const entryTokens = estimateTokens(entry.content)
    if (tokens + entryTokens > tokenBudget) break
    kept.push(entry)
    tokens += entryTokens
  }
  return kept
}

function resolvePosition(position) {
  if (position === 'after_example') return 'after_char'
  return position
}

function groupByPosition(entries) {
  const groups = { beforeChar: [], afterChar: [], beforePrompt: [], afterPrompt: [] }
  const atDepth = new Map()

  for (const entry of entries) {
    const pos = resolvePosition(entry.position)
    if (pos === 'at_depth') {
      const d = entry.depth ?? 0
      if (!atDepth.has(d)) atDepth.set(d, [])
      atDepth.get(d).push(entry)
    } else if (groups[pos]) {
      groups[pos].push(entry)
    }
  }

  const join = (arr) =>
    arr
      .sort((a, b) => (a.insertionOrder ?? 100) - (b.insertionOrder ?? 100))
      .map((e) => e.content)
      .join('\n\n')

  return {
    beforeChar: join(groups.beforeChar),
    afterChar: join(groups.afterChar),
    beforePrompt: join(groups.beforePrompt),
    afterPrompt: join(groups.afterPrompt),
    atDepth: atDepth,
  }
}

function joinAtDepth(atDepthMap) {
  const result = new Map()
  for (const [depth, entries] of atDepthMap) {
    const sorted = entries.sort((a, b) => (a.insertionOrder ?? 100) - (b.insertionOrder ?? 100))
    result.set(depth, sorted.map((e) => e.content).join('\n\n'))
  }
  return result
}

export async function getActiveLoreBlocks({ character, messages }) {
  const lorebooks = await getActiveLorebooksForCharacter(character)
  if (lorebooks.length === 0) {
    return {
      beforeChar: '',
      afterChar: '',
      beforePrompt: '',
      afterPrompt: '',
      atDepth: new Map(),
    }
  }

  const rollCache = new Map()
  const allActivated = []

  for (const lorebook of lorebooks) {
    const entries = await getEntriesForLorebook(lorebook.id)
    if (!entries.length) continue
    const buffer = buildScanBuffer(messages, lorebook.scanDepth)
    const activated = await activateEntries(lorebook, entries, buffer, character, rollCache)
    const trimmed = trimToTokenBudget(activated, lorebook.tokenBudget)
    allActivated.push(...trimmed)
  }

  const blocks = groupByPosition(allActivated)
  blocks.atDepth = joinAtDepth(blocks.atDepth)

  return blocks
}
