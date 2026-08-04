// Helpers for resolving the Status Block that a request should use.
//
// The Status Block is copied onto the thread at creation (a snapshot, like the
// scenario) and then becomes mutable per-chat: editing any message bubble
// slot's Status Block updates the thread's current value, which every payload
// request uses. The character-level Status Block is only a fallback before the
// thread snapshot exists (legacy threads, pre-lazy-init).

export function getEffectiveStatusBlock(character, threadStatusBlock) {
  if (threadStatusBlock != null) return threadStatusBlock
  return character?.statusBlock || ''
}

// Removes a leading and/or trailing code fence (3+ backticks or tildes) from a
// Status Block for visual rendering only. The opening fence's info string (e.g.
// ```markdown) is stripped along with it. The stored content is never modified.
export function stripStatusBlockCodeFences(text) {
  if (!text) return text
  const source = String(text)
  const opener = /^(\s*)(`{3,}|~{3,})[^\r\n]*(?:\r?\n)?/
  const closer = /(?:\r?\n)?\s*(`{3,}|~{3,})\s*$/
  let out = source
  if (opener.test(out)) out = out.replace(opener, '')
  if (closer.test(out)) out = out.replace(closer, '')
  return out
}

// Compares two Status Blocks for the visual "changed" highlight. Both sides are
// normalized the same way they are rendered (code fences stripped, whitespace
// trimmed) so cosmetic differences don't count as changes. Template variables
// must be resolved by the caller before comparing.
export function statusBlocksDiffer(a, b) {
  const na = (stripStatusBlockCodeFences(a) || '').trim()
  const nb = (stripStatusBlockCodeFences(b) || '').trim()
  return na !== nb
}

// Character-level diff between two strings, returned as coalesced segments of
// `{ text, changed }`. `changed` marks characters of `b` that have no match in
// `a` (additions/replacements) — used to underline only the exact text that
// changed between the previous and current Status Block. Code-point aware so
// astral characters (emoji, etc.) are never split.
export function diffChars(a, b) {
  const sa = Array.from(String(a ?? ''))
  const sb = Array.from(String(b ?? ''))
  const m = sa.length
  const n = sb.length
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = sa[i] === sb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const segments = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (sa[i] === sb[j]) {
      segments.push({ text: sb[j], changed: false })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++
    } else {
      segments.push({ text: sb[j], changed: true })
      j++
    }
  }
  while (j < n) {
    segments.push({ text: sb[j], changed: true })
    j++
  }
  const merged = []
  for (const seg of segments) {
    const last = merged[merged.length - 1]
    if (last && last.changed === seg.changed) last.text += seg.text
    else merged.push({ ...seg })
  }
  return merged
}
