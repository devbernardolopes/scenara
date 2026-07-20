import { parseBundleEntries } from './chatGeneration'
import { deleteMessage, updateMessage } from './messages'

/**
 * Detect orphaned messages left by interrupted generations.
 * Returns { type: 'send', messageId, isOOC } or
 *         { type: 'regenerate', messageId } or null.
 */
export function detectOrphanedMessages(messages) {
  if (!messages || messages.length === 0) return null

  const lastMsg = messages[messages.length - 1]

  if (
    lastMsg.role === 'assistant' &&
    lastMsg.content === '' &&
    !lastMsg.bundleMessages &&
    lastMsg.apiDurationMs == null &&
    !lastMsg.isCancelled
  ) {
    return { type: 'send', messageId: lastMsg.id, isOOC: !!lastMsg.isOOC }
  }

  for (const msg of messages) {
    if (msg.role !== 'assistant' || msg.content !== '') continue
    if (!msg.bundleMessages) continue

    const entries = parseBundleEntries(msg.bundleMessages)
    if (!entries || entries.length === 0) continue

    const activeIdx = msg.activeSlotIndex ?? entries.length - 1
    const activeEntry = entries[activeIdx]
    if (
      activeEntry &&
      activeEntry.content === '' &&
      !activeEntry.isError &&
      !activeEntry.isCancelled
    ) {
      return { type: 'regenerate', messageId: msg.id }
    }
  }

  return null
}

/**
 * Remove the orphaned empty assistant message from a failed send.
 */
export async function cleanupSendOrphan(messageId) {
  await deleteMessage(messageId)
}

/**
 * Remove the empty trailing slot from a failed regenerate and restore
 * the message to its previous slot state.
 */
export async function cleanupRegenerateOrphan(messageId, messages) {
  const msg = messages.find((m) => m.id === messageId)
  if (!msg) return

  const entries = parseBundleEntries(msg.bundleMessages)
  if (!entries || entries.length === 0) return

  entries.pop()

  const newContent = entries.length > 0 ? entries[entries.length - 1].content || '' : ''
  const newActiveSlotIndex = entries.length > 0 ? entries.length - 1 : 0

  await updateMessage(messageId, {
    bundleMessages: entries.length > 0 ? JSON.stringify(entries) : null,
    content: newContent,
    activeSlotIndex: newActiveSlotIndex,
  })
}
