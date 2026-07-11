function jsonReplacer(_key, val) {
  if (val === Infinity) return { $type: 'Infinity' }
  if (val === -Infinity) return { $type: '-Infinity' }
  return val
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, jsonReplacer, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function jsonReviver(_key, val) {
  if (val && typeof val === 'object') {
    if (val.$type === 'Infinity') return Infinity
    if (val.$type === '-Infinity') return -Infinity
  }
  return val
}
