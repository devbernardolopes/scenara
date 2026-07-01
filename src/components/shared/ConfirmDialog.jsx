import { useEffect } from 'react'

function ConfirmDialog({ title, message, confirmLabel, cancelLabel, variant = 'default', onConfirm, onCancel }) {
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

  const confirmClass =
    variant === 'danger'
      ? 'bg-error text-white hover:opacity-90'
      : 'bg-primary text-on-primary hover:bg-primary-hover'

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-overlay"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-lg shadow-surface-lg max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-text mb-2">{title}</h2>
        <p className="text-sm text-secondary mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[44px] px-4 rounded-md text-sm ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
