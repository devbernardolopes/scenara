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
    paramLimits: { stopMax: 4 },
    trialKey: 'gsk_placeholder_trial_groq_key',
  },
  {
    id: 'openrouter',
    nameKey: 'settings:api.providers.openrouter.name',
    descKey: 'settings:api.providers.openrouter.desc',
    needsKey: true,
    needsUrl: false,
    hasModelEndpoint: true,
    supportsAnonymous: false,
    paramLimits: {},
    trialKey: 'sk-or-placeholder-trial-openrouter-key',
  },
  {
    id: 'ai-horde',
    nameKey: 'settings:api.providers.aiHorde.name',
    descKey: 'settings:api.providers.aiHorde.desc',
    needsKey: false,
    needsUrl: false,
    hasModelEndpoint: true,
    supportsAnonymous: true,
    paramLimits: {},
    trialKey: 'placeholder-horde-trial-key',
  },
  {
    id: 'lm-studio',
    nameKey: 'settings:api.providers.lmStudio.name',
    descKey: 'settings:api.providers.lmStudio.desc',
    needsKey: false,
    needsUrl: true,
    hasModelEndpoint: false,
    supportsAnonymous: false,
    paramLimits: {},
    trialKey: null,
  },
]

export const DEFAULT_MODELS = {
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  openrouter: [
    'anthropic/claude-sonnet-4-20250514',
    'openai/gpt-4o',
    'google/gemini-2.5-flash',
    'meta-llama/llama-4-maverick',
  ],
  'ai-horde': ['koboldcpp/llama-3.3-70b-instruct', 'microsoft/phi-4'],
  'lm-studio': [],
}

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
