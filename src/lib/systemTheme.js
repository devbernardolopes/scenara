export function resolveSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark'
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  } catch {
    // ignore
  }
  return 'dark'
}
