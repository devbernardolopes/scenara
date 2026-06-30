import { createContext, useState, useCallback } from 'react'

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

  const ModalComponent = MODAL_COMPONENTS[modalState.type]

  return (
    <ModalContext.Provider value={{ openModal, closeModal, activeModal: modalState.type, modalProps: modalState.props }}>
      {children}
      {ModalComponent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeModal}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalComponent {...modalState.props} />
          </div>
        </div>
      )}
    </ModalContext.Provider>
  )
}

export function registerModal(type, Component) {
  MODAL_COMPONENTS[type] = Component
}
