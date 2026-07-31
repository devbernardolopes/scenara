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
