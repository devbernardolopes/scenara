import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useConfirm } from '../../lib/confirm'
import { showToast } from '../../lib/toast'
import ModalShell from '../shared/ModalShell'
import { sendChatCompletion } from '../../services/chatApi'
import { getEffectiveProfileFor } from '../../services/connectionProfiles'
import { buildDirectorMessages } from '../../services/director'
import { updateMessage } from '../../services/messages'
import db from '../../db'

function DirectorRegenerationResultModal({
  messageId,
  threadId,
  systemContent,
  userContent,
  outputDirectorResponse,
}) {
  const { t } = useTranslation('chat')
  const { closeModal, setCloseGuard } = useModal()
  const { confirm } = useConfirm()

  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [finished, setFinished] = useState(false)
  const abortRef = useRef(null)

  const triggerRequest = useCallback(
    async (sysContent, usrContent) => {
      const abortController = new AbortController()
      abortRef.current = abortController

      setLoading(true)
      setError(null)
      setResult('')
      setFinished(false)

      try {
        const profile = await getEffectiveProfileFor('director')
        if (!profile?.model) {
          throw new Error(t('directorRegenerationResult.noProfile'))
        }

        const messages = buildDirectorMessages({
          systemInstructions: sysContent,
          userInstructions: usrContent,
        })

        const response = await sendChatCompletion({
          profile,
          messages,
          signal: abortController.signal,
          onToken: (partial) => {
            setResult(partial)
          },
        })

        if (response.content?.trim()) {
          setResult(response.content)
        }
        setFinished(true)
      } catch (err) {
        if (err.name === 'AbortError') return
        setError(err.message || t('directorRegenerationResult.error'))
        setFinished(true)
      } finally {
        setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    triggerRequest(systemContent, userContent) // eslint-disable-line react-hooks/set-state-in-effect
    return () => {
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const attemptClose = useCallback(async () => {
    const ok = await confirm({
      title: t('directorRegenerationResult.cancelTitle'),
      message: t('directorRegenerationResult.cancelMessage'),
      confirmLabel: t('directorRegenerationResult.cancelConfirm'),
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
    triggerRequest(systemContent, userContent)
  }

  async function handleAccept() {
    const trimmed = result.trim()
    if (!trimmed) return

    try {
      const msg = await db.messages.get(messageId)
      if (!msg) return

      const pd = msg.promptData ? JSON.parse(msg.promptData) : {}
      pd.directorResponse = trimmed
      pd.directorResponseData = null
      pd.directorFailed = false
      pd.directorReviewed = true

      const updates = { promptData: JSON.stringify(pd) }
      if (outputDirectorResponse) {
        updates.content = trimmed
      }

      await updateMessage(messageId, updates)

      window.dispatchEvent(
        new CustomEvent('director-details-updated', {
          detail: { messageId, threadId },
        }),
      )

      closeModal()
      closeModal()
    } catch {
      showToast(t('directorRegenerationResult.error'), { type: 'error' })
    }
  }

  const canAct = finished && result.trim().length > 0 && !error

  return (
    <ModalShell
      title={t('directorRegenerationResult.title')}
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
            {t('directorRegenerationResult.accept')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? (
          <div className="rounded-lg border border-border p-4 text-sm text-error">{error}</div>
        ) : (
          <div className="rounded-lg border border-border p-4 text-sm text-text whitespace-pre-wrap">
            {result || (loading ? t('directorRegenerationResult.generating') : '')}
          </div>
        )}
      </div>
    </ModalShell>
  )
}

export default DirectorRegenerationResultModal
