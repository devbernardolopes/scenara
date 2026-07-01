import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../lib/toast'
import { getSetting } from '../../services/settings'
import { X, Info, CheckCircle, AlertTriangle, XCircle } from '../../lib/icons'

const POSITION_CLASSES = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
}

function getFlexCol(position) {
  return position.startsWith('top') ? 'flex-col' : 'flex-col-reverse'
}

function getItemsAlign(position) {
  if (position.includes('center')) return 'items-center'
  if (position.includes('left')) return 'items-start'
  return 'items-end'
}

function getEnterAnim(position) {
  return position.startsWith('top') ? 'animate-toast-enter-top' : 'animate-toast-enter-bottom'
}

function getExitAnim(position) {
  return position.startsWith('top') ? 'animate-toast-exit-top' : 'animate-toast-exit-bottom'
}

const TYPE_ICON = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
}

const TYPE_ACCENT = {
  info: 'border-l-accent',
  success: 'border-l-success',
  warning: 'border-l-warning',
  error: 'border-l-error',
}

const TYPE_ICON_COLOR = {
  info: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
}

function ToastItem({ toast, isDismissible, onDismiss, onTogglePause, position }) {
  const { t } = useTranslation('common')
  const Icon = TYPE_ICON[toast.type] || Info
  const accentClass = TYPE_ACCENT[toast.type] || TYPE_ACCENT.info
  const iconColorClass = TYPE_ICON_COLOR[toast.type] || TYPE_ICON_COLOR.info
  const enterClass = getEnterAnim(position)
  const exitClass = getExitAnim(position)

  return (
    <div
      className={`
        flex items-start gap-3 w-full max-w-sm min-h-[44px] px-4 py-3
        bg-surface border border-border-light shadow-surface-md rounded-lg
        border-l-4 ${accentClass}
        ${toast.exiting ? exitClass + ' pointer-events-none' : enterClass}
      `}
      onMouseEnter={() => !isDismissible && onTogglePause(toast.id)}
      onMouseLeave={() => toast.paused && onTogglePause(toast.id)}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColorClass}`} />
      <p className="flex-1 text-sm text-text min-w-0">{toast.message}</p>
      <div className="flex items-center gap-1 shrink-0 min-h-[44px]">
        {toast.paused && (
          <span className="text-xs text-tertiary whitespace-nowrap">{t('toast.paused')}</span>
        )}
        {isDismissible ? (
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-surface-hover text-tertiary hover:text-text transition-colors"
            aria-label={t('toast.dismiss')}
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onTogglePause(toast.id)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-surface-hover text-tertiary hover:text-text transition-colors"
            aria-label={toast.paused ? t('toast.resume') : t('toast.pause')}
          >
            {toast.paused ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

function ToastContainer() {
  const { toasts, removeToast, togglePause } = useToast()
  const [position, setPosition] = useState('top-right')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getSetting('toastPosition').then((val) => {
      setPosition(val || 'top-right')
      setLoaded(true)
    })
    const handler = (e) => {
      if (e.detail.key === 'toastPosition') {
        getSetting('toastPosition').then(setPosition)
      }
    }
    window.addEventListener('settings-changed', handler)
    return () => window.removeEventListener('settings-changed', handler)
  }, [])

  if (!loaded || toasts.length === 0) return null

  const oldestIndex = toasts.length - 1

  return (
    <div
      className={`fixed z-60 flex ${getFlexCol(position)} ${getItemsAlign(position)} gap-2 pointer-events-none ${POSITION_CLASSES[position]}`}
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast, index) => (
        <div key={toast.id} className="pointer-events-auto w-full">
          <ToastItem
            toast={toast}
            isDismissible={index === oldestIndex}
            onDismiss={removeToast}
            onTogglePause={togglePause}
            position={position}
          />
        </div>
      ))}
    </div>
  )
}

export default ToastContainer
