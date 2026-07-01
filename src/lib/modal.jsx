import { createContext, useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

export const ModalContext = createContext(null)

const MODAL_COMPONENTS = {}

export function ModalProvider({ children }) {
  const [modalState, setModalState] = useState({ type: null, props: {} })
  const closeGuardRef = useRef(null)

  const setCloseGuard = useCallback((guard) => {
    closeGuardRef.current = guard
  }, [])

  const openModal = useCallback((type, props = {}) => {
    closeGuardRef.current = null
    setModalState({ type, props })
  }, [])

  const closeModal = useCallback(() => {
    closeGuardRef.current = null
    setModalState({ type: null, props: {} })
  }, [])

  const closeWithGuard = useCallback(() => {
    const guard = closeGuardRef.current
    if (guard) {
      const result = guard()
      if (result === false) return
    }
    closeModal()
  }, [closeModal])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') closeWithGuard()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeWithGuard])

  const ModalComponent = MODAL_COMPONENTS[modalState.type]
  const { t } = useTranslation('common')
  const modalSize = modalState.props?.modalSize === 'lg' ? 'max-w-4xl' : 'max-w-lg'

  return (
    <ModalContext.Provider
      value={{
        openModal,
        closeModal,
        setCloseGuard,
        activeModal: modalState.type,
        modalProps: modalState.props,
      }}
    >
      {children}
      {ModalComponent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay" onClick={closeWithGuard}>
          <Suspense
            fallback={
              <div
                className={`bg-surface rounded-lg shadow-surface-lg ${modalSize} w-full mx-4 p-12 text-center text-secondary text-sm`}
              >
                {t('loading')}
              </div>
            }
          >
            <div
              className={`bg-surface rounded-lg shadow-surface-lg ${modalSize} w-full mx-4 max-h-[85vh] overflow-y-auto`}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalComponent {...modalState.props} />
            </div>
          </Suspense>
        </div>
      )}
    </ModalContext.Provider>
  )
}

export function registerModal(type, Component) {
  MODAL_COMPONENTS[type] = Component
}
