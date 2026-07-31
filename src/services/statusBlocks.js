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
