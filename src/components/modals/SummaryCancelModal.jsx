import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { getState } from '../../services/apiQueue'
import { cancelPendingSummarizationAndClearMarker } from '../../services/summarization'
import ModalShell from '../shared/ModalShell'

function SummaryCancelModal({ threadId }) {
  const { t } = useTranslation('chat')
  const { closeModal } = useModal()
  const [active, setActive] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const update = useCallback(() => {
    const state = getState()
    const tid = Number(threadId)
    const isActive =
      state.inflight.some((i) => i.threadId === tid && i.type === 'summarization') ||
      state.queue.some((q) => q.threadId === tid && q.type === 'summarization')
    setActive(isActive)
  }, [threadId])

  useEffect(() => {
    update()
    window.addEventListener('api-queue-changed', update)
    return () => window.removeEventListener('api-queue-changed', update)
  }, [update])

  async function handleConfirm() {
    if (!active || cancelling) return
    setCancelling(true)
    await cancelPendingSummarizationAndClearMarker(threadId)
    closeModal()
  }

  return (
    <ModalShell
      title={t('summaryCancelTitle')}
      onClose={closeModal}
      footer={
        <>
          <button
            type="button"
            onClick={closeModal}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!active || cancelling}
            className="min-h-[44px] px-6 bg-error text-white rounded-md hover:opacity-90 text-sm disabled:opacity-50"
          >
            {cancelling ? t('cancelling') : t('summaryCancelButton')}
          </button>
        </>
      }
    >
      {active ? (
        <div className="space-y-3">
          <p className="text-sm text-secondary">{t('summaryCancelMessage')}</p>
          <p className="text-xs text-tertiary">{t('summaryCancelHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-secondary">{t('summaryCancelDone')}</p>
          <p className="text-xs text-tertiary">{t('summaryCancelDoneHint')}</p>
        </div>
      )}
    </ModalShell>
  )
}

export default SummaryCancelModal
