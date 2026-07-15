import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { getState, cancelAutoTitleRequests } from '../../services/apiQueue'
import ModalShell from '../shared/ModalShell'

function AutoTitleCancelModal({ threadId }) {
  const { t } = useTranslation('chat')
  const { closeModal } = useModal()
  const [active, setActive] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const update = useCallback(() => {
    const state = getState()
    const tid = Number(threadId)
    const isActive =
      state.inflight.some((i) => i.threadId === tid && i.type === 'autoTitle') ||
      state.queue.some((q) => q.threadId === tid && q.type === 'autoTitle')
    setActive(isActive)
  }, [threadId])

  useEffect(() => {
    update()
    window.addEventListener('api-queue-changed', update)
    return () => window.removeEventListener('api-queue-changed', update)
  }, [update])

  function handleConfirm() {
    if (!active || cancelling) return
    setCancelling(true)
    cancelAutoTitleRequests(threadId)
    closeModal()
  }

  return (
    <ModalShell
      title={t('autoTitleCancelTitle')}
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
            {cancelling ? t('cancelling') : t('autoTitleCancelButton')}
          </button>
        </>
      }
    >
      {active ? (
        <div className="space-y-3">
          <p className="text-sm text-secondary">{t('autoTitleCancelMessage')}</p>
          <p className="text-xs text-tertiary">{t('autoTitleCancelHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-secondary">{t('autoTitleCancelDone')}</p>
          <p className="text-xs text-tertiary">{t('autoTitleCancelDoneHint')}</p>
        </div>
      )}
    </ModalShell>
  )
}

export default AutoTitleCancelModal
