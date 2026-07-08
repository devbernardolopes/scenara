import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useConfirm } from '../../lib/confirm'
import ModalShell from '../shared/ModalShell'
import { sendChatCompletion } from '../../services/chatApi'
import { getEffectiveProfileFor } from '../../services/connectionProfiles'
import { updateThreadMemory } from '../../services/threadMemories'
import { updateThread } from '../../services/threads'

function MemoryRegenerationResultModal({ threadId, entry, systemContent, userContent }) {
  const { t } = useTranslation(['chat', 'common'])
  const { closeModal, setCloseGuard } = useModal()
  const { confirm } = useConfirm()

  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [finished, setFinished] = useState(false)
  const abortRef = useRef(null)

  const triggerRequest = useCallback(
    async (content) => {
      const abortController = new AbortController()
      abortRef.current = abortController

      setLoading(true)
      setError(null)
      setResult('')
      setFinished(false)

      try {
        const profile = await getEffectiveProfileFor('summarization')
        if (!profile?.model) {
          throw new Error(t('memoryRegeneration.noProfile'))
        }

        const response = await sendChatCompletion({
          profile,
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content },
          ],
          signal: abortController.signal,
          onToken: (partial) => {
            setResult(partial)
          },
        })

        if (response?.trim()) {
          setResult(response)
        }
        setFinished(true)
      } catch (err) {
        if (err.name === 'AbortError') return
        setError(err.message || t('memoryRegeneration.error'))
        setFinished(true)
      } finally {
        setLoading(false)
      }
    },
    [systemContent, t],
  )

  useEffect(() => {
    triggerRequest(userContent)
    return () => {
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const attemptClose = useCallback(async () => {
    const ok = await confirm({
      title: t('memoryRegeneration.cancelTitle'),
      message: t('memoryRegeneration.cancelMessage'),
      confirmLabel: t('memoryRegeneration.cancelConfirm'),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (!ok) return

    abortRef.current?.abort()
    closeModal()
  }, [closeModal, confirm, t])

  useEffect(() => {
    setCloseGuard(() => {
      void attemptClose()
      return false
    })
    return () => setCloseGuard(null)
  }, [attemptClose, setCloseGuard])

  function handleRegenerate() {
    abortRef.current?.abort()
    triggerRequest(userContent)
  }

  async function handleAccept() {
    const trimmed = result.trim()
    if (!trimmed) return

    await updateThreadMemory(entry.id, { content: trimmed })

    const updatedPayload = entry.payload ? [...entry.payload] : []
    if (updatedPayload.length >= 2) {
      updatedPayload[1] = { ...updatedPayload[1], content: userContent }
    }
    await updateThreadMemory(entry.id, { payload: updatedPayload })
    await updateThread(threadId, { memory: trimmed })

    window.dispatchEvent(
      new CustomEvent('memory-regenerated', { detail: { threadId: Number(threadId) } }),
    )

    closeModal()
    closeModal()
  }

  const canAct = finished && result.trim().length > 0 && !error

  return (
    <ModalShell
      title={t('memoryRegeneration.resultTitle')}
      onClose={attemptClose}
      footer={
        <>
          <button
            type="button"
            onClick={attemptClose}
            className="min-h-[44px] px-4 rounded-md text-sm text-secondary hover:text-text"
          >
            {t('common:cancel')}
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={!canAct}
            className="min-h-[44px] px-4 rounded-md text-sm bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60"
          >
            {t('memoryRegeneration.regenerate')}
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={!canAct}
            className="min-h-[44px] px-4 rounded-md text-sm bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60"
          >
            {t('memoryRegeneration.accept')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? (
          <div className="rounded-lg border border-border p-4 text-sm text-error">{error}</div>
        ) : (
          <div className="rounded-lg border border-border p-4 text-sm text-text whitespace-pre-wrap">
            {result || (loading ? t('memoryRegeneration.generating') : '')}
          </div>
        )}
      </div>
    </ModalShell>
  )
}

export default MemoryRegenerationResultModal
