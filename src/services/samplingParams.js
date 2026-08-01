import { PROVIDERS } from './apiProviders'

// Shared helpers for applying user-saved sampling profiles, stop-sequence
// sets, and server recommendations onto a connection profile's params. All
// presets are generic key/value stores: only keys the target provider/method
// declares are merged, and each value is coerced to the provider schema type.

export function getProviderParamDefs(providerId) {
  return PROVIDERS.find((p) => p.id === providerId)?.params || []
}

function coerceValueForDef(def, raw) {
  if (raw === undefined || raw === null || raw === '') return null
  if (def?.key === 'sampler_order' && Array.isArray(raw)) {
    return raw.join(',')
  }
  if (def?.type === 'range' || def?.type === 'slider') {
    const n = Number(raw)
    return Number.isNaN(n) ? raw : n
  }
  if (def?.type === 'boolean') {
    return raw === true || raw === 'true' || raw === '1'
  }
  if (def?.type === 'string-list') {
    if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean)
    return String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return raw
}

// Merges a preset's params into a target provider's schema, dropping any keys
// the provider does not declare (for the active method) and coercing values to
// the schema's declared type. Returns only the filtered/coerced entries.
export function filterParamsForProvider(params, providerId, activeMethod) {
  const defs = getProviderParamDefs(providerId)
  const out = {}
  for (const [key, raw] of Object.entries(params || {})) {
    if (key === 'hordeMethod' || key === 'hordeMethodTemplate') continue
    const def = defs.find((d) => d.key === key)
    if (!def) continue
    const method = def.method || 'all'
    if (activeMethod && method !== 'all' && method !== activeMethod) continue
    const value = coerceValueForDef(def, raw)
    if (value !== null) out[key] = value
  }
  return out
}

// Names of the sampling params a provider exposes for the given method.
export function getSupportedParamKeys(providerId, activeMethod) {
  const defs = getProviderParamDefs(providerId)
  return defs
    .filter((d) => {
      const method = d.method || 'all'
      return !activeMethod || method === 'all' || method === activeMethod
    })
    .map((d) => d.key)
}
