import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { getState, cancelThreadRequests } from '../../services/apiQueue'
import ModalShell from '../shared/ModalShell'

function CancelConfirmModal({ threadId }) {
  const { t } = useTranslation('chat')
  const { closeModal } = useModal()
  const [requests, setRequests] = useState([])
  const [cancelling, setCancelling] = useState(false)

  const updateRequests = useCallback(() => {
    const state = getState()
    const tid = Number(threadId)
    const items = []

    if (state.currentThreadId === tid && state.currentRequestType) {
      items.push({
        type: state.currentRequestType,
        status: 'executing',
        director: state.currentRequestDirector,
      })
    }

    for (const item of state.queue) {
      if (item.threadId === tid) {
        if (item.id !== state.currentRequestId) {
          items.push({ type: item.type, status: 'queued' })
        }
      }
    }

    setRequests(items)
  }, [threadId])

  useEffect(() => {
    updateRequests()
    window.addEventListener('api-queue-changed', updateRequests)
    return () => window.removeEventListener('api-queue-changed', updateRequests)
  }, [updateRequests])

  const hasRequests = requests.length > 0

  function handleConfirm() {
    const state = getState()
    const tid = Number(threadId)
    const stillActive =
      state.currentThreadId === tid || state.queue.some((item) => item.threadId === tid)
    if (!stillActive) return

    setCancelling(true)
    cancelThreadRequests(threadId)
    closeModal()
  }

  return (
    <ModalShell
      title={t('cancelConfirmTitle')}
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
            disabled={!hasRequests || cancelling}
            className="min-h-[44px] px-6 bg-error text-white rounded-md hover:opacity-90 text-sm disabled:opacity-50"
          >
            {cancelling ? t('cancelling') : t('cancelConfirmButton')}
          </button>
        </>
      }
    >
      {hasRequests ? (
        <div className="space-y-3">
          <p className="text-sm text-secondary">{t('cancelConfirmMessage')}</p>
          <ul className="space-y-2">
            {requests.map((req, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between px-3 py-2 bg-surface-secondary rounded-md text-sm"
              >
                <span className="text-text">
                  {t(`requestType_${req.type}`, { defaultValue: req.type })}
                  {req.director ? ` ${t('requestType_directorSuffix')}` : ''}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    req.status === 'executing'
                      ? 'bg-primary-subtle text-primary'
                      : 'bg-surface text-tertiary border border-border-light'
                  }`}
                >
                  {t(`requestStatus_${req.status}`, { defaultValue: req.status })}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-tertiary">{t('cancelConfirmHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-secondary">{t('requestNoLongerActive')}</p>
          <p className="text-xs text-tertiary">{t('cancelConfirmDoneHint')}</p>
        </div>
      )}
    </ModalShell>
  )
}

export default CancelConfirmModal
