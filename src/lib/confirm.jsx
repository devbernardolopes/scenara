import { createContext, useState, useCallback, useRef, useContext } from 'react'
import ConfirmDialog from '../components/shared/ConfirmDialog'

const ConfirmContext = createContext(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    variant: 'default',
  })
  const resolveRef = useRef(null)

  const confirm = useCallback(({ title, message, confirmLabel, cancelLabel, variant } = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setState({
        open: true,
        title: title || 'Confirm',
        message: message || 'Are you sure?',
        confirmLabel: confirmLabel || 'Confirm',
        cancelLabel: cancelLabel || 'Cancel',
        variant: variant || 'default',
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true)
    setState((prev) => ({ ...prev, open: false }))
  }, [])

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false)
    setState((prev) => ({ ...prev, open: false }))
  }, [])

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.open && (
        <ConfirmDialog
          title={state.title}
          message={state.message}
          confirmLabel={state.confirmLabel}
          cancelLabel={state.cancelLabel}
          variant={state.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  )
}
