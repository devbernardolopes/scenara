import { createContext, useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useTranslation } from 'react-i18next'

export const ModalContext = createContext(null)

const MODAL_COMPONENTS = {}

export function ModalProvider({ children }) {
  const [modalStack, setModalStack] = useState([])
  const closeGuardRef = useRef(null)

  const setCloseGuard = useCallback((guard) => {
    closeGuardRef.current = guard
  }, [])

  const openModal = useCallback((type, props = {}) => {
    closeGuardRef.current = null
    setModalStack((prev) => [...prev, { type, props }])
  }, [])

  const updateModal = useCallback((props) => {
    setModalStack((prev) => {
      if (prev.length === 0) return prev
      const updated = [...prev]
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        props: { ...updated[updated.length - 1].props, ...props },
      }
      return updated
    })
  }, [])

  const closeModal = useCallback(() => {
    closeGuardRef.current = null
    setModalStack((prev) => prev.slice(0, -1))
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

  const { t } = useTranslation('common')
  const activeModal = modalStack.length > 0 ? modalStack[modalStack.length - 1].type : null
  const modalProps = modalStack.length > 0 ? modalStack[modalStack.length - 1].props : {}

  return (
    <ModalContext.Provider
      value={{
        openModal,
        closeModal,
        updateModal,
        setCloseGuard,
        activeModal,
        modalProps,
      }}
    >
      {children}
      {modalStack.map((state, index) => {
        const ModalComponent = MODAL_COMPONENTS[state.type]
        if (!ModalComponent) return null
        const isTop = index === modalStack.length - 1
        const isFullscreen = state.props.modalSize === 'fullscreen'
        return (
          <div
            key={index}
            className={`fixed inset-0 ${isFullscreen ? 'bg-overlay' : 'flex items-center justify-center bg-overlay'}`}
            style={{ zIndex: 50 + index }}
            onClick={isTop ? closeWithGuard : undefined}
          >
            <Suspense
              fallback={
                <div className="bg-surface rounded-lg shadow-surface-lg max-w-4xl w-full mx-4 p-12 text-center text-secondary text-sm">
                  {t('loading')}
                </div>
              }
            >
              {isFullscreen ? (
                <div className="w-full h-full" onClick={(e) => e.stopPropagation()}>
                  <ModalComponent {...state.props} />
                </div>
              ) : (
                <div
                  className="bg-surface rounded-lg shadow-surface-lg max-w-4xl w-full mx-4 h-[75vh] max-h-[85vh] flex flex-col overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ModalComponent {...state.props} />
                </div>
              )}
            </Suspense>
          </div>
        )
      })}
    </ModalContext.Provider>
  )
}

export function registerModal(type, Component) {
  MODAL_COMPONENTS[type] = Component
}
