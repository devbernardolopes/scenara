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
      {
        key: 'max_completion_tokens',
        label: 'Max Tokens',
        type: 'range',
        min: 256,
        max: 8192,
        step: 256,
        default: 1024,
      },
      {
        key: 'max_tokens',
        label: 'Max Tokens (Deprecated)',
        type: 'range',
        min: 256,
        max: 8192,
        step: 256,
        default: null,
        deprecated: true,
      },
      {
        key: 'temperature',
        label: 'Temperature',
        type: 'range',
        min: 0,
        max: 2,
        step: 0.05,
        default: 0.75,
      },
      { key: 'top_p', label: 'Top P', type: 'range', min: 0, max: 1, step: 0.05, default: 0 },
      {
        key: 'frequency_penalty',
        label: 'Frequency Penalty',
        type: 'range',
        min: -2,
        max: 2,
        step: 0.01,
        default: 0,
      },
      {
        key: 'presence_penalty',
        label: 'Presence Penalty',
        type: 'range',
        min: -2,
        max: 2,
        step: 0.01,
        default: 0,
      },
      { key: 'stream', label: 'Stream', type: 'boolean', default: false },
      { key: 'stop', label: 'Stop Strings', type: 'string-list', maxItems: 4 },
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
      {
        key: 'max_completion_tokens',
        label: 'Max Tokens',
        type: 'range',
        min: 256,
        max: 8192,
        step: 256,
        default: 1024,
      },
      {
        key: 'max_tokens',
        label: 'Max Tokens (Deprecated)',
        type: 'range',
        min: 256,
        max: 8192,
        step: 256,
        default: null,
        deprecated: true,
      },
      {
        key: 'temperature',
        label: 'Temperature',
        type: 'range',
        min: 0,
        max: 2,
        step: 0.05,
        default: 0.75,
      },
      { key: 'top_p', label: 'Top P', type: 'range', min: 0, max: 1, step: 0.05, default: 0 },
      {
        key: 'frequency_penalty',
        label: 'Frequency Penalty',
        type: 'range',
        min: -2,
        max: 2,
        step: 0.01,
        default: 0,
      },
      {
        key: 'presence_penalty',
        label: 'Presence Penalty',
        type: 'range',
        min: -2,
        max: 2,
        step: 0.01,
        default: 0,
      },
      { key: 'stream', label: 'Stream', type: 'boolean', default: false },
      { key: 'stop', label: 'Stop Strings', type: 'string-list' },
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
    params: [
      {
        key: 'max_completion_tokens',
        label: 'Max Tokens',
        type: 'range',
        min: 256,
        max: 8192,
        step: 256,
        default: 1024,
      },
      {
        key: 'max_tokens',
        label: 'Max Tokens (Deprecated)',
        type: 'range',
        min: 256,
        max: 8192,
        step: 256,
        default: null,
        deprecated: true,
      },
      {
        key: 'temperature',
        label: 'Temperature',
        type: 'range',
        min: 0,
        max: 2,
        step: 0.05,
        default: 0.75,
      },
      { key: 'top_p', label: 'Top P', type: 'range', min: 0, max: 1, step: 0.05, default: 0 },
      {
        key: 'frequency_penalty',
        label: 'Frequency Penalty',
        type: 'range',
        min: -2,
        max: 2,
        step: 0.01,
        default: 0,
      },
      {
        key: 'presence_penalty',
        label: 'Presence Penalty',
        type: 'range',
        min: -2,
        max: 2,
        step: 0.01,
        default: 0,
      },
      { key: 'stream', label: 'Stream', type: 'boolean', default: false },
      { key: 'stop', label: 'Stop Strings', type: 'string-list' },
    ],
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
      {
        key: 'max_completion_tokens',
        label: 'Max Tokens',
        type: 'range',
        min: 256,
        max: 8192,
        step: 256,
        default: 1024,
      },
      {
        key: 'max_tokens',
        label: 'Max Tokens (Deprecated)',
        type: 'range',
        min: 256,
        max: 8192,
        step: 256,
        default: null,
        deprecated: true,
      },
      {
        key: 'temperature',
        label: 'Temperature',
        type: 'range',
        min: 0,
        max: 2,
        step: 0.05,
        default: 0.75,
      },
      { key: 'top_p', label: 'Top P', type: 'range', min: 0, max: 1, step: 0.05, default: 0 },
      {
        key: 'frequency_penalty',
        label: 'Frequency Penalty',
        type: 'range',
        min: -2,
        max: 2,
        step: 0.01,
        default: 0,
      },
      {
        key: 'presence_penalty',
        label: 'Presence Penalty',
        type: 'range',
        min: -2,
        max: 2,
        step: 0.01,
        default: 0,
      },
      { key: 'stream', label: 'Stream', type: 'boolean', default: false },
      { key: 'stop', label: 'Stop Strings', type: 'string-list' },
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

function cachedModelsKey(providerId, hordeMethod) {
  if (providerId === 'ai-horde' && hordeMethod) {
    return `api.${providerId}.cachedModels.${hordeMethod}`
  }
  return `api.${providerId}.cachedModels`
}

export async function getCachedModels(providerId, hordeMethod) {
  const raw = await getSetting(cachedModelsKey(providerId, hordeMethod))
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function setCachedModels(providerId, models, hordeMethod) {
  await setSetting(cachedModelsKey(providerId, hordeMethod), JSON.stringify(models))
}

function cachedModelMetaKey(providerId, hordeMethod) {
  return `api.${providerId}.cachedModelsMeta.${hordeMethod || 'native'}`
}

export async function getCachedModelMeta(providerId, hordeMethod) {
  const raw = await getSetting(cachedModelMetaKey(providerId, hordeMethod))
  try {
    return JSON.parse(raw) || {}
  } catch {
    return {}
  }
}

export async function setCachedModelMeta(providerId, meta, hordeMethod) {
  await setSetting(cachedModelMetaKey(providerId, hordeMethod), JSON.stringify(meta))
}
