export const COLOR_SLOTS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink']

export const COLOR_PALETTES = {
  light: {
    red: '#ef4444',
    orange: '#f97316',
    yellow: '#eab308',
    green: '#22c55e',
    teal: '#14b8a6',
    blue: '#3b82f6',
    purple: '#a855f7',
    pink: '#ec4899',
  },
  dark: {
    red: '#ef4444',
    orange: '#f97316',
    yellow: '#facc15',
    green: '#4ade80',
    teal: '#2dd4bf',
    blue: '#60a5fa',
    purple: '#c084fc',
    pink: '#f472b6',
  },
  sepia: {
    red: '#dc2626',
    orange: '#ea580c',
    yellow: '#ca8a04',
    green: '#16a34a',
    teal: '#0d9488',
    blue: '#2563eb',
    purple: '#9333ea',
    pink: '#db2777',
  },
  pastel: {
    red: '#fca5a5',
    orange: '#fdba74',
    yellow: '#fde68a',
    green: '#86efac',
    teal: '#5eead4',
    blue: '#93c5fd',
    purple: '#c4b5fd',
    pink: '#f9a8d4',
  },
  'high-contrast': {
    red: '#dc2626',
    orange: '#ea580c',
    yellow: '#ca8a04',
    green: '#16a34a',
    teal: '#0d9488',
    blue: '#1d4ed8',
    purple: '#9333ea',
    pink: '#db2777',
  },
  'high-contrast-dark': {
    red: '#ff6b6b',
    orange: '#ff922b',
    yellow: '#ffd43b',
    green: '#51cf66',
    teal: '#20c997',
    blue: '#5c7cfa',
    purple: '#cc5de8',
    pink: '#f06595',
  },
  terminal: {
    red: '#ff4444',
    orange: '#ff8800',
    yellow: '#ffff00',
    green: '#00ff00',
    teal: '#00ffaa',
    blue: '#4488ff',
    purple: '#cc44ff',
    pink: '#ff44aa',
  },
}

export function getPalette(theme) {
  return COLOR_PALETTES[theme] || COLOR_PALETTES.light
}

export function getColorHex(theme, slotIndex) {
  const slot = COLOR_SLOTS[slotIndex]
  if (!slot) return ''
  const palette = getPalette(theme)
  return palette[slot] || ''
}

export function findColorSlot(hex, theme) {
  if (!hex) return -1
  const palette = getPalette(theme)
  const h = hex.toLowerCase()
  for (let i = 0; i < COLOR_SLOTS.length; i++) {
    if (palette[COLOR_SLOTS[i]].toLowerCase() === h) return i
  }
  return -1
}
