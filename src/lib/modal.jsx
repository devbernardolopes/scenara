import { createContext, useState, useCallback, useEffect, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

export const ModalContext = createContext(null)

const MODAL_COMPONENTS = {}

export function ModalProvider({ children }) {
  const [modalState, setModalState] = useState({ type: null, props: {} })

  const openModal = useCallback((type, props = {}) => {
    setModalState({ type, props })
  }, [])

  const closeModal = useCallback(() => {
    setModalState({ type: null, props: {} })
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeModal])

  const ModalComponent = MODAL_COMPONENTS[modalState.type]
  const { t } = useTranslation('common')
  const modalSize = modalState.props?.modalSize === 'lg' ? 'max-w-4xl' : 'max-w-lg'

  return (
    <ModalContext.Provider
      value={{
        openModal,
        closeModal,
        activeModal: modalState.type,
        modalProps: modalState.props,
      }}
    >
      {children}
      {ModalComponent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay" onClick={closeModal}>
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
