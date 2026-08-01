import { getUIState, setUIState } from './uiState'
import { getSupportedParamKeys } from './samplingParams'

// Server-served recommended settings for AI Horde Native models. The manifest
// is a static JSON file in public/ (deployed as /horde-model-settings.json on
// Vercel) so it can be updated without a code release. Results are cached in
// uiState with a TTL and refreshed lazily / on demand.

const MANIFEST_URL = '/horde-model-settings.json'
const CACHE_KEY = 'hordeRecommendations'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

function sanitizeManifest(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.models)) return null
  const hordeKeys = getSupportedParamKeys('ai-horde', 'native')
  const models = raw.models
    .filter((m) => m && typeof m.id === 'string' && m.id.trim())
    .map((m) => {
      const presets = (Array.isArray(m.presets) ? m.presets : [])
        .filter((p) => p && typeof p.id === 'string' && p.id.trim())
        .map((p) => ({
          id: p.id,
          label: typeof p.label === 'string' ? p.label : p.id,
          description: typeof p.description === 'string' ? p.description : '',
          promptTemplate:
            typeof p.promptTemplate === 'string' && p.promptTemplate.trim()
              ? p.promptTemplate
              : null,
          stopSequences: Array.isArray(p.stopSequences)
            ? p.stopSequences
                .filter((s) => typeof s === 'string')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          params: sanitizeParams(p.params, hordeKeys),
        }))
        .filter((p) => Object.keys(p.params).length > 0)
      return {
        id: m.id,
        name: typeof m.name === 'string' && m.name.trim() ? m.name : m.id,
        homepage: typeof m.homepage === 'string' ? m.homepage : '',
        presets,
      }
    })
    .filter((m) => m.presets.length > 0)
  if (models.length === 0) return null
  return { version: raw.version ?? null, models }
}

function sanitizeParams(params, allowedKeys) {
  const out = {}
  for (const [key, value] of Object.entries(params || {})) {
    if (!allowedKeys.includes(key)) continue
    if (value === undefined || value === null || value === '') continue
    out[key] = value
  }
  return out
}

export async function getCachedRecommendations() {
  const cached = await getUIState(CACHE_KEY)
  return cached?.data || null
}

export async function loadRecommendations({ force = false } = {}) {
  const cached = await getUIState(CACHE_KEY)
  if (
    !force &&
    cached?.data &&
    typeof cached.fetchedAt === 'number' &&
    Date.now() - cached.fetchedAt < CACHE_TTL_MS
  ) {
    return cached.data
  }
  try {
    const res = await fetch(MANIFEST_URL, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return cached?.data || null
    const raw = await res.json()
    const sanitized = sanitizeManifest(raw)
    if (!sanitized) return cached?.data || null
    await setUIState(CACHE_KEY, { fetchedAt: Date.now(), data: sanitized })
    window.dispatchEvent(new CustomEvent('hordeRecommendations-changed'))
    return sanitized
  } catch {
    return cached?.data || null
  }
}

export function findModelRecommendation(data, modelId) {
  if (!data || !modelId) return null
  return data.models.find((m) => m.id === modelId) || null
}

export function getPreset(modelRec, presetId) {
  if (!modelRec || !presetId) return null
  return modelRec.presets.find((p) => p.id === presetId) || null
}
