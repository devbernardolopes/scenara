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

// A bodyless GET must not send `Content-Type: application/json`: the header is
// meaningless without a body and forces a CORS preflight (OPTIONS) that local
// servers like LM Studio reject unless "Enable CORS" is turned on. Omitting it
// keeps the request CORS-simple whenever no Authorization header is needed.
function buildGetHeaders(apiKey) {
  const headers = {}
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  return headers
}

// Matches loopback hosts: the only case where we can tell the user exactly
// what to do (enable CORS / start the server) instead of showing a generic
// network error.
export function isLocalBaseUrl(url) {
  try {
    const { hostname } = new URL(url)
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]'
    )
  } catch {
    return false
  }
}

// Browser CORS and connection failures surface as an opaque TypeError
// ("Failed to fetch"). For loopback URLs that almost always means the local
// server is offline or rejected the cross-origin request, so tag the error and
// let the UI explain the fix. AbortErrors pass through untouched.
async function fetchLocalModels(url, { headers, signal, providerId }) {
  try {
    return await fetch(url, { headers, signal })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    if (isLocalBaseUrl(url) && err instanceof TypeError) {
      const wrapped = new Error(`Request to ${url} was blocked or refused.`)
      wrapped.code = 'LOCAL_FETCH_BLOCKED'
      wrapped.baseUrl = url
      wrapped.providerId = providerId
      wrapped.cause = err
      throw wrapped
    }
    throw err
  }
}

const STRATEGIES = {
  groq: { type: 'openai', needsKey: true },
  cerebras: { type: 'openai', needsKey: true },
  openrouter: { type: 'openai', needsKey: true },
  'ai-horde': { type: 'horde', needsKey: false },
  'lm-studio': { type: 'openai', needsKey: false },
}

async function fetchOpenAIModels(baseUrl, apiKey, signal, modelsPath, providerId) {
  const url = modelsPath ? `${baseUrl}${modelsPath}` : `${baseUrl}/v1/models`

  const res = await fetchLocalModels(url, {
    headers: buildGetHeaders(apiKey),
    signal,
    providerId,
  })
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

async function fetchOpenRouterModels(baseUrl, apiKey, signal, providerId) {
  const url = `${baseUrl}/v1/models?max_price=0&input_modalities=text`

  const res = await fetchLocalModels(url, {
    headers: buildGetHeaders(apiKey),
    signal,
    providerId,
  })
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
    let baseUrl = profileBaseUrl ? profileBaseUrl.replace(/\/v1\/?$/, '') : null
    if (!baseUrl) {
      const rawUrl = await getBaseUrl(providerId)
      if (rawUrl) baseUrl = rawUrl.replace(/\/v1\/?$/, '')
    }
    if (!baseUrl) {
      const def = getDefaultBaseUrl(providerId)
      baseUrl = def ? def.replace(/\/v1\/?$/, '') : null
    }
    if (!baseUrl) throw new Error(`No base URL configured for ${providerId}`)
    const result = await fetchOpenRouterModels(baseUrl, apiKey, signal, providerId)
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
    let baseUrl = profileBaseUrl ? profileBaseUrl.replace(/\/v1\/?$/, '') : null
    if (!baseUrl) {
      const rawUrl = await getBaseUrl(providerId)
      if (rawUrl) baseUrl = rawUrl.replace(/\/v1\/?$/, '')
    }
    if (!baseUrl) {
      const def = getDefaultBaseUrl(providerId)
      baseUrl = def ? def.replace(/\/v1\/?$/, '') : null
    }
    if (!baseUrl) throw new Error(`No base URL configured for ${providerId}`)
    models = await fetchOpenAIModels(baseUrl, apiKey, signal, undefined, providerId)
  } else {
    throw new Error(`Unknown fetch strategy "${strategy.type}" for ${providerId}`)
  }

  startCooldown()
  return { models, meta: {} }
}
