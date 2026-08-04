const EMOJI_SEQUENCE_RE =
  /^(?:[\u{1F1E6}-\u{1F1FF}]{2}|[0-9#*]\uFE0F\u20E3|\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*(?:[\u{1F3FB}-\u{1F3FF}])?)$/u

export function isExternalImageUrl(src) {
  if (typeof src !== 'string') return false
  return /^https?:\/\//.test(src)
}

export function isViewableImage(src) {
  if (typeof src !== 'string' || !src) return false
  return src.startsWith('data:image/') || isExternalImageUrl(src)
}

export function isSingleEmoji(value) {
  if (typeof value !== 'string' || !value) return false
  return EMOJI_SEQUENCE_RE.test(value)
}

export function isValidAvatar(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return true
  if (trimmed.startsWith('data:image/')) return true
  if (isExternalImageUrl(trimmed)) {
    try {
      new URL(trimmed)
      return true
    } catch {
      return false
    }
  }
  return isSingleEmoji(trimmed)
}

export function normalizeAvatar(value) {
  return typeof value === 'string' ? value.trim() : ''
}
