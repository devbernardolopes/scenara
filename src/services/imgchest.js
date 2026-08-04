const DEFAULT_BASE_URL = 'https://api.imgchest.com/v1'

const MAX_BYTES = 5 * 1024 * 1024

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!parts) throw new Error('Invalid data URL')
  const mime = parts[1]
  const binary = atob(parts[2])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function getMimeType(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);/)
  return match ? match[1] : ''
}

export function validateImgchestUploadSize(dataUrl) {
  const byteLen = dataUrl.length * 0.75
  if (byteLen > MAX_BYTES) {
    return { ok: false, limitMB: 5 }
  }
  return { ok: true }
}

function normalizeBaseUrl(baseUrl) {
  return (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

export async function imgchestUpload(token, dataUrl, baseUrl, { signal } = {}) {
  const blob = dataUrlToBlob(dataUrl)
  const ext = getMimeType(dataUrl).split('/')[1] || 'png'
  const file = new File([blob], `avatar.${ext}`, { type: blob.type })

  const form = new FormData()
  form.append('nsfw', 'true')
  form.append('privacy', 'secret')
  form.append('anonymous', 'true')
  form.append('images[]', file)

  const res = await fetch(`${normalizeBaseUrl(baseUrl)}/post`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal,
  })
  if (!res.ok) {
    let message = `Image Chest API error: ${res.status}`
    try {
      const body = await res.json()
      message = body?.message || body?.error || message
    } catch {
      // keep the status-based message
    }
    throw new Error(message)
  }
  const data = await res.json()
  const link = data?.data?.images?.[0]?.link
  if (!link) throw new Error('Image Chest response missing image link')
  return link
}
