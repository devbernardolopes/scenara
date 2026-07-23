import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

function SaveDialog({ onSave, onDiscard, onCancel, saveDisabled = false, message }) {
  const { t } = useTranslation('common')

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center bg-overlay"
      onClick={onCancel}
    >
      <div
        className="bg-glass border-glass rounded-lg shadow-surface-lg max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-text mb-2">{t('saveDialog.title')}</h2>
        <p className="text-sm text-secondary mb-6">{message ?? t('saveDialog.message')}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('saveDialog.cancel')}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="min-h-[44px] px-4 text-sm text-error hover:opacity-80"
          >
            {t('saveDialog.discard')}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled}
            className={`min-h-[44px] px-4 text-sm btn-primary ${
              saveDisabled ? 'opacity-50 cursor-not-allowed hover:bg-primary' : ''
            }`}
          >
            {t('saveDialog.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SaveDialog
