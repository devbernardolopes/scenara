import { getActiveKey, getBaseUrl, getDefaultBaseUrl } from './apiProviders'

const COOLDOWN_MS = 5000
let _lastFetchTime = 0

export function getCooldownRemaining() {
  return Math.max(0, COOLDOWN_MS - (Date.now() - _lastFetchTime))
}

export function isOnCooldown() {
  return getCooldownRemaining() > 0
}

function startCooldown() {
  _lastFetchTime = Date.now()
}

export function resetCooldown() {
  _lastFetchTime = 0
}

const STRATEGIES = {
  groq: { type: 'openai', needsKey: true },
  cerebras: { type: 'openai', needsKey: true },
  openrouter: { type: 'openai', needsKey: true },
  'ai-horde': { type: 'horde', needsKey: false },
  'lm-studio': { type: 'openai', needsKey: false },
}

async function fetchOpenAIModels(baseUrl, apiKey, signal, modelsPath) {
  const url = modelsPath ? `${baseUrl}${modelsPath}` : `${baseUrl}/v1/models`
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const res = await fetch(url, { headers, signal })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ''}`)
  }

  const json = await res.json()
  const models = (json.data || [])
    .filter((m) => (m.id || m.name) && m.active !== false)
    .map((m) => m.id)
    .sort((a, b) => a.localeCompare(b))
  return models
}

async function fetchOpenRouterModels(baseUrl, apiKey, signal) {
  const url = `${baseUrl}/v1/models?max_price=0&input_modalities=text`
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const res = await fetch(url, { headers, signal })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ''}`)
  }

  const json = await res.json()
  const names = {}
  const supportedParams = {}
  const models = (json.data || [])
    .filter((m) => {
      if (!(m.id || m.name)) return false
      if (m.active === false) return false
      if (m.architecture?.modality !== 'text->text') return false
      if (m.pricing?.prompt !== '0' || m.pricing?.completion !== '0') return false
      return true
    })
    .map((m) => {
      if (m.name) names[m.id] = m.name
      if (Array.isArray(m.supported_parameters)) {
        supportedParams[m.id] = m.supported_parameters
      }
      return m.id
    })
    .sort((a, b) => a.localeCompare(b))

  return { models, meta: {}, names, supportedParams }
}

async function fetchHordeModels(signal) {
  const url = 'https://stablehorde.net/api/v2/status/models?type=text&model_state=all'
  const res = await fetch(url, { signal })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ''}`)
  }
  const json = await res.json()
  const entries = Array.isArray(json) ? json : []
  const meta = {}
  const models = entries
    .filter((entry) => entry?.name)
    .map((entry) => {
      meta[entry.name] = {
        count: entry.count,
        queued: entry.queued,
        eta: entry.eta,
        performance: entry.performance,
      }
      return entry.name
    })
    .sort((a, b) => a.localeCompare(b))
  return { models, meta }
}

export async function fetchModels(
  providerId,
  { signal, hordeMethod: _hordeMethod, baseUrl: profileBaseUrl } = {},
) {
  if (providerId === 'ai-horde') {
    const result = await fetchHordeModels(signal)
    startCooldown()
    return result
  }

  if (providerId === 'openrouter') {
    const strategy = STRATEGIES[providerId]
    let apiKey = null
    if (strategy.needsKey) {
      const keyEntry = await getActiveKey(providerId)
      if (!keyEntry) {
        throw new Error(`No active API key configured for ${providerId}`)
      }
      apiKey = keyEntry.value
    }
    let baseUrl = profileBaseUrl || null
    if (!baseUrl) {
      const rawUrl = await getBaseUrl(providerId)
      if (rawUrl) baseUrl = rawUrl.replace(/\/v1\/?$/, '')
    }
    if (!baseUrl) {
      const def = getDefaultBaseUrl(providerId)
      baseUrl = def ? def.replace(/\/v1\/?$/, '') : null
    }
    if (!baseUrl) throw new Error(`No base URL configured for ${providerId}`)
    const result = await fetchOpenRouterModels(baseUrl, apiKey, signal)
    startCooldown()
    return result
  }

  const strategy = STRATEGIES[providerId]
  if (!strategy) throw new Error(`No fetch strategy defined for provider "${providerId}"`)

  let apiKey = null
  if (strategy.needsKey) {
    const keyEntry = await getActiveKey(providerId)
    if (!keyEntry) {
      throw new Error(`No active API key configured for ${providerId}`)
    }
    apiKey = keyEntry.value
  }

  let models
  if (strategy.type === 'openai') {
    let baseUrl = profileBaseUrl || null
    if (!baseUrl) {
      const rawUrl = await getBaseUrl(providerId)
      if (rawUrl) baseUrl = rawUrl.replace(/\/v1\/?$/, '')
    }
    if (!baseUrl) {
      const def = getDefaultBaseUrl(providerId)
      baseUrl = def ? def.replace(/\/v1\/?$/, '') : null
    }
    if (!baseUrl) throw new Error(`No base URL configured for ${providerId}`)
    models = await fetchOpenAIModels(baseUrl, apiKey, signal)
  } else {
    throw new Error(`Unknown fetch strategy "${strategy.type}" for ${providerId}`)
  }

  startCooldown()
  return { models, meta: {} }
}
