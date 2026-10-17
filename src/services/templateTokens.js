// Single-pass `{{token}}` expansion, shared by every prompt builder.
//
// Two correctness properties this exists to guarantee:
//
//   1. Replacement values are inserted verbatim. Passing the value as a plain
//      string replacement argument to `String.replace` makes JS expand `$&`,
//      `$$`, `$'` and `` $` `` inside that value, silently corrupting any
//      message or name that happens to contain them (`$$x^2$$` -> `$x^2$`).
//   2. Inserted text is never re-scanned. `String.replace` does not revisit its
//      own replacement output, so a message that literally contains a token
//      (e.g. `{{system}}`, `{{content}}`) survives untouched instead of being
//      substituted by a later pass over the same string.
//
// Matching is case-insensitive and tokens without a matching key are left
// exactly as written, so `{{unknown}}` passes through unchanged.
export function substituteTokens(text, vars) {
  if (!text) return text
  const table = new Map()
  for (const [key, value] of Object.entries(vars || {})) {
    table.set(key.toLowerCase(), String(value ?? ''))
  }
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = table.get(key.toLowerCase())
    return value === undefined ? match : value
  })
}
