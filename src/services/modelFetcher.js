import { getActiveKey } from './apiProviders'

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
  groq: { type: 'openai', baseUrl: 'https://api.groq.com', needsKey: true },
  openrouter: { type: 'openai', baseUrl: 'https://openrouter.ai/api', needsKey: true },
  'ai-horde': { type: 'horde', needsKey: false },
  'lm-studio': { type: 'openai', baseUrl: null, needsKey: false },
}

async function fetchOpenAIModels(baseUrl, apiKey, signal, modelsPath) {
  const url = modelsPath ? `${baseUrl}${modelsPath}` : `${baseUrl}/openai/v1/models`
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const res = await fetch(url, { headers, signal })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ''}`)
  }

  const json = await res.json()
  const models = (json.data || [])
    .filter((m) => m.id && m.active !== false)
    .map((m) => m.id)
    .sort((a, b) => a.localeCompare(b))
  return models
}

async function fetchHordeModels(signal) {
  const url = 'https://stablehorde.net/api/v2/status/models?type=text&model_state=all'
  const res = await fetch(url, { signal })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ''}`)
  }
  const json = await res.json()
  const models = Object.keys(json)
    .filter((id) => json[id]?.queued !== undefined)
    .sort((a, b) => a.localeCompare(b))
  return models
}

export async function fetchModels(providerId, { signal, hordeMethod } = {}) {
  if (providerId === 'ai-horde') {
    if (hordeMethod === 'openai-compatible') {
      const keyEntry = await getActiveKey(providerId)
      const apiKey = keyEntry?.value || null
      const models = await fetchOpenAIModels(
        'https://stablehorde.net',
        apiKey,
        signal,
        '/v1/models',
      )
      startCooldown()
      return models
    }
    const models = await fetchHordeModels(signal)
    startCooldown()
    return models
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
    const baseUrl = strategy.baseUrl
    if (!baseUrl) throw new Error(`No base URL configured for ${providerId}`)
    models = await fetchOpenAIModels(baseUrl, apiKey, signal)
  } else {
    throw new Error(`Unknown fetch strategy "${strategy.type}" for ${providerId}`)
  }

  startCooldown()
  return models
}
