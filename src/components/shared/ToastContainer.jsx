import { useState, useEffect } from 'react'
import { useToast } from '../../lib/toast'
import { getSetting } from '../../services/settings'
import { Info, CheckCircle, AlertTriangle, XCircle } from '../../lib/icons'

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

function ToastItem({ toast, onDismiss, position }) {
  const Icon = TYPE_ICON[toast.type] || Info
  const accentClass = TYPE_ACCENT[toast.type] || TYPE_ACCENT.info
  const iconColorClass = TYPE_ICON_COLOR[toast.type] || TYPE_ICON_COLOR.info
  const enterClass = getEnterAnim(position)
  const exitClass = getExitAnim(position)

  return (
    <div
      onClick={() => onDismiss(toast.id)}
      className={`
        flex items-start gap-3 w-full max-w-sm min-h-[44px] px-4 py-3
        bg-glass shadow-surface-md rounded-lg border-glass
        border-l-4 ${accentClass} cursor-pointer
        ${toast.exiting ? exitClass + ' pointer-events-none' : enterClass}
      `}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColorClass}`} />
      <p className="flex-1 text-sm text-text min-w-0">{toast.message}</p>
    </div>
  )
}

function ToastContainer() {
  const { toasts, removeToast } = useToast()
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

  return (
    <div
      className={`fixed z-60 flex ${getFlexCol(position)} ${getItemsAlign(position)} gap-2 pointer-events-none ${POSITION_CLASSES[position]}`}
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto w-full">
          <ToastItem toast={toast} onDismiss={removeToast} position={position} />
        </div>
      ))}
    </div>
  )
}

export default ToastContainer
