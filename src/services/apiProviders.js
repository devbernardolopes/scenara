import { getSetting, setSetting } from './settings'

export const PROVIDERS = [
  {
    id: 'groq',
    nameKey: 'settings:api.providers.groq.name',
    descKey: 'settings:api.providers.groq.desc',
    needsKey: true,
    needsUrl: false,
    hasModelEndpoint: true,
    supportsAnonymous: false,
    trialKey: 'gsk_placeholder_trial_groq_key',
    params: [
      { key: 'temperature', type: 'range', min: 0, max: 2, step: 0.1, default: 1 },
      { key: 'top_p', type: 'range', min: 0, max: 1, step: 0.05, default: 1 },
      { key: 'stop', type: 'string-list', maxItems: 4 },
      { key: 'stream', type: 'boolean', default: true },
      { key: 'max_tokens', type: 'range', min: 64, max: 32768, step: 64, default: 2048 },
    ],
  },
  {
    id: 'openrouter',
    nameKey: 'settings:api.providers.openrouter.name',
    descKey: 'settings:api.providers.openrouter.desc',
    needsKey: true,
    needsUrl: false,
    hasModelEndpoint: true,
    supportsAnonymous: false,
    trialKey: 'sk-or-placeholder-trial-openrouter-key',
    params: [
      { key: 'temperature', type: 'range', min: 0, max: 2, step: 0.1, default: 1 },
      { key: 'top_p', type: 'range', min: 0, max: 1, step: 0.05, default: 1 },
      { key: 'stop', type: 'string-list' },
      { key: 'stream', type: 'boolean', default: true },
      { key: 'max_tokens', type: 'range', min: 64, max: 32768, step: 64, default: 2048 },
    ],
  },
  {
    id: 'ai-horde',
    nameKey: 'settings:api.providers.aiHorde.name',
    descKey: 'settings:api.providers.aiHorde.desc',
    needsKey: true,
    needsUrl: false,
    hasModelEndpoint: true,
    supportsAnonymous: false,
    supportsHordeMethods: true,
    trialKey: 'placeholder-horde-trial-key',
    params: [{ key: 'temperature', type: 'range', min: 0, max: 2, step: 0.1, default: 1 }],
  },
  {
    id: 'lm-studio',
    nameKey: 'settings:api.providers.lmStudio.name',
    descKey: 'settings:api.providers.lmStudio.desc',
    needsKey: false,
    needsUrl: true,
    hasModelEndpoint: false,
    supportsAnonymous: false,
    trialKey: null,
    params: [
      { key: 'temperature', type: 'range', min: 0, max: 2, step: 0.1, default: 1 },
      { key: 'top_p', type: 'range', min: 0, max: 1, step: 0.05, default: 1 },
      { key: 'stop', type: 'string-list' },
      { key: 'stream', type: 'boolean', default: true },
      { key: 'max_tokens', type: 'range', min: 64, max: 32768, step: 64, default: 2048 },
    ],
  },
]

export const DEFAULT_ACTIVE_PROVIDER = 'groq'

function pKey(providerId, field) {
  return `api.${providerId}.${field}`
}

export async function getActiveProvider() {
  return (await getSetting('api.activeProvider')) || DEFAULT_ACTIVE_PROVIDER
}

export async function setActiveProvider(providerId) {
  await setSetting('api.activeProvider', providerId)
}

export async function getModel(providerId) {
  return (await getSetting(pKey(providerId, 'model'))) || null
}

export async function setModel(providerId, model) {
  await setSetting(pKey(providerId, 'model'), model)
}

export async function getBaseUrl(providerId) {
  return (await getSetting(pKey(providerId, 'baseUrl'))) || null
}

export async function setBaseUrl(providerId, url) {
  await setSetting(pKey(providerId, 'baseUrl'), url)
}

export async function getFavModels(providerId) {
  const raw = await getSetting(pKey(providerId, 'favModels'))
  try {
    return JSON.parse(raw) || []
  } catch {
    return []
  }
}

export async function toggleFavModel(providerId, model) {
  const favs = await getFavModels(providerId)
  const idx = favs.indexOf(model)
  if (idx > -1) {
    favs.splice(idx, 1)
  } else {
    favs.push(model)
  }
  await setSetting(pKey(providerId, 'favModels'), JSON.stringify(favs))
  return favs
}

let _keyIdCounter = 0

function generateKeyId() {
  _keyIdCounter++
  return `km_${_keyIdCounter}_${Date.now()}`
}

export async function getKeys(providerId) {
  const raw = await getSetting(pKey(providerId, 'keys'))
  try {
    return JSON.parse(raw) || []
  } catch {
    return []
  }
}

function saveKeys(providerId, keys) {
  return setSetting(pKey(providerId, 'keys'), JSON.stringify(keys))
}

export async function addKey(providerId, { value, label }) {
  const keys = await getKeys(providerId)
  const active = keys.length === 0
  keys.push({ id: generateKeyId(), value, label: label || '', active })
  await saveKeys(providerId, keys)
  return keys
}

export async function updateKey(providerId, keyId, { value, label }) {
  const keys = await getKeys(providerId)
  const key = keys.find((k) => k.id === keyId)
  if (!key) return keys
  if (value !== undefined) key.value = value
  if (label !== undefined) key.label = label
  await saveKeys(providerId, keys)
  return keys
}

export async function deleteKey(providerId, keyId) {
  let keys = await getKeys(providerId)
  const removed = keys.find((k) => k.id === keyId)
  keys = keys.filter((k) => k.id !== keyId)
  if (removed?.active && keys.length > 0) {
    keys[0].active = true
  }
  await saveKeys(providerId, keys)
  return keys
}

export async function setActiveKey(providerId, keyId) {
  const keys = await getKeys(providerId)
  for (const k of keys) {
    k.active = k.id === keyId
  }
  await saveKeys(providerId, keys)
  return keys
}

export async function getActiveKey(providerId) {
  const keys = await getKeys(providerId)
  return keys.find((k) => k.active) || null
}

export function maskKey(value) {
  if (!value || value.length <= 4) return value || ''
  return '••••' + value.slice(-4)
}

function cachedModelsKey(providerId) {
  return `api.${providerId}.cachedModels`
}

export async function getCachedModels(providerId) {
  const raw = await getSetting(cachedModelsKey(providerId))
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function setCachedModels(providerId, models) {
  await setSetting(cachedModelsKey(providerId), JSON.stringify(models))
}
