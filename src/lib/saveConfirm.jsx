import { createContext, useState, useCallback, useRef, useContext } from 'react'
import SaveDialog from '../components/shared/SaveDialog'

const SaveConfirmContext = createContext(null)

export function useSaveConfirm() {
  const ctx = useContext(SaveConfirmContext)
  if (!ctx) throw new Error('useSaveConfirm must be used within SaveConfirmProvider')
  return ctx
}

export function SaveConfirmProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState({})
  const resolveRef = useRef(null)

  const promptSave = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setOptions(opts)
      setOpen(true)
    })
  }, [])

  function handleAction(action) {
    resolveRef.current?.(action)
    resolveRef.current = null
    setOpen(false)
    setOptions({})
  }

  return (
    <SaveConfirmContext.Provider value={{ promptSave }}>
      {children}
      {open && (
        <SaveDialog
          saveDisabled={options.saveDisabled}
          message={options.message}
          onSave={() => handleAction('save')}
          onDiscard={() => handleAction('discard')}
          onCancel={() => handleAction('cancel')}
        />
      )}
    </SaveConfirmContext.Provider>
  )
}
