import { importCharacterCard } from './characterCardImport'

const CHUB_URL_PATTERN =
  /^https?:\/\/(www\.|venus\.)?(chub\.ai|characterhub\.org)\/characters\/(.+?)\/(.+?)(?:\/|\?|#|$)/

export function parseChubUrl(urlString) {
  const match = urlString.trim().match(CHUB_URL_PATTERN)
  if (!match) return null
  return { creator: match[3], name: match[4] }
}

export async function importCharacterFromUrl(urlString, { signal } = {}) {
  const parts = parseChubUrl(urlString)
  if (!parts) {
    throw new Error('Unsupported URL')
  }

  const proxyUrl = `/api/chub-proxy?url=${encodeURIComponent(urlString.trim())}`
  const res = await fetch(proxyUrl, { signal })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || `Request failed (${res.status})`)
  }

  const cardJson = await res.json()
  const result = await importCharacterCard(cardJson)
  return result.data
}
