const codeModules = import.meta.glob('../builtins/codes/*.json', {
  eager: true,
  import: 'default',
})

export function loadCodes() {
  return Object.values(codeModules)
    .filter((c) => c && typeof c.code === 'string' && c.code.trim())
    .sort((a, b) => a.code.localeCompare(b.code))
}

export function getCodeEntry(code) {
  const normalized = String(code || '')
    .trim()
    .toUpperCase()
  return loadCodes().find((c) => c.code.toUpperCase() === normalized) || null
}
