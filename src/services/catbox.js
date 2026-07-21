const API_URL = '/api/catbox-proxy'

const GIF_MAX_BYTES = 20 * 1024 * 1024
const IMAGE_MAX_BYTES = 200 * 1024 * 1024

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

export function validateUploadSize(dataUrl) {
  const mime = getMimeType(dataUrl)
  const byteLen = dataUrl.length * 0.75
  const isGif = mime === 'image/gif'
  const limit = isGif ? GIF_MAX_BYTES : IMAGE_MAX_BYTES
  if (byteLen > limit) {
    return { ok: false, limitMB: isGif ? 20 : 200 }
  }
  return { ok: true }
}

function parseResponse(text) {
  const trimmed = text.trim()
  if (trimmed.startsWith('http')) return trimmed
  throw new Error(trimmed || 'Upload failed')
}

export async function catboxUpload(userhash, dataUrl) {
  const blob = dataUrlToBlob(dataUrl)
  const ext = getMimeType(dataUrl).split('/')[1] || 'png'
  const file = new File([blob], `avatar.${ext}`, { type: blob.type })

  const form = new FormData()
  form.append('reqtype', 'fileupload')
  if (userhash) form.append('userhash', userhash)
  form.append('fileToUpload', file)

  const res = await fetch(API_URL, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Catbox API error: ${res.status}`)
  const text = await res.text()
  return parseResponse(text)
}

export async function catboxCreateAlbum(userhash, title, desc = '') {
  const form = new FormData()
  form.append('reqtype', 'createalbum')
  if (userhash) form.append('userhash', userhash)
  form.append('title', title)
  form.append('desc', desc)
  form.append('files', '')

  const res = await fetch(API_URL, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Catbox API error: ${res.status}`)
  const text = await res.text()
  const url = parseResponse(text)
  const short = url.split('/').pop()
  return { short, url }
}

export async function catboxAddToAlbum(userhash, albumShort, fileShortCodes) {
  const form = new FormData()
  form.append('reqtype', 'addtoalbum')
  if (userhash) form.append('userhash', userhash)
  form.append('short', albumShort)
  form.append('files', fileShortCodes.join(' '))

  const res = await fetch(API_URL, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`Catbox API error: ${res.status}`)
  const text = await res.text()
  if (text.trim() !== 'OK') throw new Error(text.trim() || 'Failed to add to album')
}

export function extractFileShortCode(url) {
  const match = url.match(/\/([a-f0-9]{6})\.\w+$/)
  return match ? match[1] : null
}

export function formatFileSize(byteLen) {
  if (byteLen < 1024) return `${byteLen} B`
  if (byteLen < 1024 * 1024) return `${(byteLen / 1024).toFixed(1)} KB`
  return `${(byteLen / (1024 * 1024)).toFixed(1)} MB`
}
