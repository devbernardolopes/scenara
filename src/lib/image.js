export function isExternalImageUrl(src) {
  if (typeof src !== 'string') return false
  return /^https?:\/\//.test(src)
}

export function isViewableImage(src) {
  if (typeof src !== 'string' || !src) return false
  return src.startsWith('data:image/') || isExternalImageUrl(src)
}
