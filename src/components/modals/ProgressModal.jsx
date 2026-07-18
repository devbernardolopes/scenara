import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import CloseButton from '../shared/CloseButton'
import { CheckCircle, AlertTriangle, Loader } from '../../lib/icons'

function ProgressModal({ status, label, onDone }) {
  const { t } = useTranslation('settings')
  const { closeModal, setCloseGuard } = useModal()

  const isWorking = status === 'exporting' || status === 'importing'
  const isSuccess = status === 'exported' || status === 'imported'
  const isError = status === 'error'

  useEffect(() => {
    if (isWorking) {
      setCloseGuard(() => false)
    } else {
      setCloseGuard(null)
    }
    return () => setCloseGuard(null)
  }, [isWorking, setCloseGuard])

  function handleClose() {
    if (onDone) onDone()
    closeModal()
  }

  function handleRestart() {
    window.location.href = '/'
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 border-b border-border shrink-0">
        <h2 className="text-xl font-semibold text-text">
          {status === 'exporting'
            ? t('database.exportModal.exporting')
            : status === 'exported'
              ? t('database.exportModal.title')
              : status === 'importing'
                ? t('database.importModal.importing')
                : status === 'imported'
                  ? t('database.importModal.title')
                  : label}
        </h2>
        {(isSuccess || isError) && <CloseButton onClick={handleClose} />}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-4">
        {isWorking && (
          <>
            <Loader className="w-10 h-10 text-primary animate-spin" />
            <p className="text-secondary text-sm">
              {status === 'exporting'
                ? t('database.exportModal.exporting')
                : t('database.importModal.importing')}
            </p>
          </>
        )}
        {isSuccess && (
          <>
            <CheckCircle className="w-10 h-10 text-success" />
            <p className="text-text text-sm font-medium">
              {status === 'exported'
                ? t('database.exportModal.exported')
                : t('database.importModal.imported')}
            </p>
          </>
        )}
        {isError && (
          <>
            <AlertTriangle className="w-10 h-10 text-error" />
            <p className="text-text text-sm font-medium">{label}</p>
          </>
        )}
      </div>
      {(isSuccess || isError) && (
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={status === 'imported' ? handleRestart : handleClose}
            className="min-h-[44px] px-4 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm"
          >
            {status === 'imported'
              ? t('database.importModal.restart')
              : isError
                ? t('database.importModal.close')
                : t('database.exportModal.close')}
          </button>
        </div>
      )}
    </div>
  )
}

export default ProgressModal
