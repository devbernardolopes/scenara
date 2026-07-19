// Pure mapping between SillyTavern/Chub World Info JSON and Scenara's
// canonical lorebook field shape. Kept separate from services/lorebooks.js so
// format tweaks stay localized as more Chub file variants appear in the wild.

const SECONDARY_LOGIC_MAP = {
  0: 'andAny',
  1: 'andAll',
  2: 'notAny',
  3: 'notAll',
}

const SECONDARY_LOGIC_REVERSE = {
  andAny: 0,
  andAll: 1,
  notAny: 2,
  notAll: 3,
}

// Raw SillyTavern position enum values. We store these as opaque strings and
// don't validate against Scenara prompt slots yet (that's Phase 2).
export const POSITION_OPTIONS = [
  'before_char',
  'after_char',
  'at_depth',
  'before_prompt',
  'after_prompt',
  'after_example',
]

export function isLorebookObject(obj) {
  if (!obj || typeof obj !== 'object') return false
  if (typeof obj.name !== 'string' && !('entries' in obj) && !('name' in obj)) return false
  return true
}

export function mapEntryFromST(entry) {
  if (!entry || typeof entry !== 'object') return null
  const keys = entry.keys ?? entry.key ?? []
  const secondaryKeys = entry.secondary_keys ?? entry.keysecondary ?? []
  const selective = Boolean(entry.selective)
  const secondaryLogic = selective ? (SECONDARY_LOGIC_MAP[entry.selectiveLogic] ?? null) : null
  const useProbability = entry.useProbability ?? entry.probability != null
  const probability =
    useProbability && typeof entry.probability === 'number' ? entry.probability : null
  const constant = Boolean(entry.constant)
  const charFilter = entry.characterFilter ?? entry.extensions?.characterFilter ?? null

  return {
    name: entry.name ?? entry.comment ?? '',
    keys: Array.isArray(keys) ? keys : keys ? [keys] : [],
    secondaryKeys: Array.isArray(secondaryKeys)
      ? secondaryKeys
      : secondaryKeys
        ? [secondaryKeys]
        : [],
    secondaryLogic,
    content: entry.content ?? '',
    constant,
    enabled: entry.enabled ?? !entry.disable,
    position: mapPositionFromST(entry.position),
    insertionOrder: entry.insertion_order ?? entry.order ?? 100,
    depth: entry.depth ?? entry.extensions?.depth ?? null,
    probability,
    caseSensitive: Boolean(entry.case_sensitive),
    excludeRecursion: Boolean(entry.excludeRecursion ?? entry.extensions?.excludeRecursion),
    characterFilter: charFilter,
    sourceMeta: entry.extensions?.chub
      ? { chub: entry.extensions.chub }
      : entry.extensions
        ? { extensions: entry.extensions }
        : null,
  }
}

function mapPositionFromST(pos) {
  if (typeof pos === 'string' && POSITION_OPTIONS.includes(pos)) return pos
  if (typeof pos === 'number') {
    const map = {
      0: 'before_char',
      1: 'after_char',
      2: 'at_depth',
      3: 'before_prompt',
      4: 'after_prompt',
      5: 'after_example',
    }
    if (map[pos]) return map[pos]
  }
  return 'before_char'
}

function mapPositionToST(pos) {
  const idx = POSITION_OPTIONS.indexOf(pos)
  return idx >= 0 ? idx : 1
}

export function mapLorebookFromST(obj) {
  if (!isLorebookObject(obj)) return null

  const entriesRaw = obj.entries ?? {}
  const entries = Array.isArray(entriesRaw) ? entriesRaw : Object.values(entriesRaw)

  const mappedEntries = entries
    .map(mapEntryFromST)
    .filter(Boolean)
    .map((e, i) => ({ ...e, order: e.insertionOrder ?? i * 100 }))

  const lorebook = {
    name: obj.name?.trim() || 'Imported Lorebook',
    avatar: obj.extensions?.chub?.background_image || '',
    description: obj.description ?? '',
    scanDepth: obj.scan_depth ?? null,
    tokenBudget: obj.token_budget ?? null,
    recursiveScanning: Boolean(obj.recursive_scanning),
    isGlobal: false,
    sourceMeta: obj.extensions?.chub
      ? { chub: obj.extensions.chub }
      : obj.extensions
        ? { extensions: obj.extensions }
        : null,
  }

  return { lorebook, entries: mappedEntries }
}

export function mapLorebookToST(lorebook, entries) {
  const st = {
    name: lorebook.name || '',
    description: lorebook.description || '',
    scan_depth: lorebook.scanDepth ?? 50,
    token_budget: lorebook.tokenBudget ?? 500,
    recursive_scanning: Boolean(lorebook.recursiveScanning),
    extensions: {},
  }

  const chubBase = lorebook.sourceMeta?.chub
  if (chubBase) {
    st.extensions.chub = { ...chubBase }
  }

  const entriesOut = {}
  const sorted = [...entries].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  sorted.forEach((entry, idx) => {
    const uid = entry.id ?? idx + 1
    const position = entry.position || 'before_char'
    const probability =
      entry.probability == null ? 100 : Math.min(100, Math.max(0, entry.probability))
    const isSelective = Boolean(entry.secondaryLogic)
    const selectiveLogic =
      entry.secondaryLogic != null ? (SECONDARY_LOGIC_REVERSE[entry.secondaryLogic] ?? 0) : 0

    const stEntry = {
      uid,
      key: entry.keys ?? [],
      keys: entry.keys ?? [],
      keysecondary: entry.secondaryKeys ?? [],
      secondary_keys: entry.secondaryKeys ?? [],
      comment: entry.name || '',
      name: entry.name || '',
      content: entry.content || '',
      constant: Boolean(entry.constant),
      selective: isSelective,
      selectiveLogic,
      order: entry.insertionOrder ?? entry.order ?? idx * 100,
      position: mapPositionToST(position),
      disable: !entry.enabled,
      enabled: entry.enabled ?? true,
      addMemo: true,
      excludeRecursion: Boolean(entry.excludeRecursion),
      probability,
      useProbability: entry.probability != null,
      displayIndex: idx,
      depth: entry.depth ?? 4,
      case_sensitive: Boolean(entry.caseSensitive),
      characterFilter: entry.characterFilter ?? null,
      extensions: {
        depth: entry.depth ?? 4,
        weight: 10,
        addMemo: true,
        displayIndex: idx,
        useProbability: entry.probability != null,
        characterFilter: entry.characterFilter ?? null,
        excludeRecursion: Boolean(entry.excludeRecursion),
      },
    }

    if (entry.sourceMeta?.chub) {
      stEntry.extensions.chub = { ...entry.sourceMeta.chub }
    }

    entriesOut[uid] = stEntry
  })

  st.entries = entriesOut
  return st
}
