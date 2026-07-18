export function isExternalImageUrl(src) {
  if (typeof src !== 'string') return false
  return /^https?:\/\//.test(src)
}
