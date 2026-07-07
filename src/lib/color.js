export function hexToLuminance(hex) {
  if (!hex || typeof hex !== 'string') return 1
  const h = hex.replace('#', '')
  if (h.length < 6) return 1
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

export function isLightColor(hex) {
  return hexToLuminance(hex) > 0.55
}

export function getContrastColor(hex) {
  if (!hex) return null
  return isLightColor(hex) ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)'
}

export function getContrastColorHover(hex) {
  if (!hex) return null
  return isLightColor(hex) ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)'
}
