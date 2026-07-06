import { createContext, useState, useCallback, useRef, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmDialog from '../components/shared/ConfirmDialog'

const ConfirmContext = createContext(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}

export function ConfirmProvider({ children }) {
  const { t } = useTranslation('common')
  const [state, setState] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: t('confirm'),
    cancelLabel: t('cancel'),
    variant: 'default',
    children: null,
  })
  const resolveRef = useRef(null)

  const confirm = useCallback(
    ({ title, message, confirmLabel, cancelLabel, variant, children } = {}) => {
      return new Promise((resolve) => {
        resolveRef.current = resolve
        setState({
          open: true,
          title: title || t('confirm'),
          message: message || t('confirmDefaultMessage'),
          confirmLabel: confirmLabel || t('confirm'),
          cancelLabel: cancelLabel || t('cancel'),
          variant: variant || 'default',
          children: children || null,
        })
      })
    },
    [t],
  )

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
        >
          {state.children}
        </ConfirmDialog>
      )}
    </ConfirmContext.Provider>
  )
}
