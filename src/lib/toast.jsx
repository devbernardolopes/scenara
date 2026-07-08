import { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from 'react'

const ToastContext = createContext(null)

export function showToast(message, { type = 'info', duration } = {}) {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type, duration } }))
}

const MAX_VISIBLE = 5
const EXIT_MS = 300

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const removeToast = useCallback((id) => {
    clearTimeout(timersRef.current[id])
    delete timersRef.current[id]
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, EXIT_MS)
  }, [])

  const pauseToast = useCallback((id) => {
    setToasts((prev) =>
      prev.map((t) => {
        if (t.id !== id || t.paused) return t
        clearTimeout(timersRef.current[id])
        const elapsed = Date.now() - t._startedAt
        return { ...t, paused: true, _remaining: t._remaining - elapsed }
      }),
    )
  }, [])

  const resumeToast = useCallback(
    (id) => {
      setToasts((prev) =>
        prev.map((t) => {
          if (t.id !== id || !t.paused) return t
          const remaining = t._remaining
          const timerId = setTimeout(() => removeToast(id), remaining)
          timersRef.current[id] = timerId
          return { ...t, paused: false, _startedAt: Date.now() }
        }),
      )
    },
    [removeToast],
  )

  const togglePause = useCallback(
    (id) => {
      setToasts((prev) => {
        const t = prev.find((x) => x.id === id)
        if (!t) return prev
        if (t.paused) {
          const remaining = t._remaining
          const timerId = setTimeout(() => removeToast(id), remaining)
          timersRef.current[id] = timerId
          return prev.map((x) =>
            x.id === id ? { ...x, paused: false, _startedAt: Date.now(), pausedByBlur: false } : x,
          )
        } else {
          clearTimeout(timersRef.current[id])
          const elapsed = Date.now() - t._startedAt
          return prev.map((x) =>
            x.id === id
              ? { ...x, paused: true, _remaining: x._remaining - elapsed, pausedByBlur: false }
              : x,
          )
        }
      })
    },
    [removeToast],
  )

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        setToasts((prev) => {
          for (const t of prev) {
            if (!t.paused) clearTimeout(timersRef.current[t.id])
          }
          return prev.map((t) => {
            if (t.paused) return t
            const elapsed = Date.now() - t._startedAt
            return { ...t, paused: true, _remaining: t._remaining - elapsed, pausedByBlur: true }
          })
        })
      } else {
        setToasts((prev) => {
          for (const t of prev) {
            if (t.paused && t.pausedByBlur) {
              const timerId = setTimeout(() => removeToast(t.id), t._remaining)
              timersRef.current[t.id] = timerId
            }
          }
          return prev.map((t) =>
            t.paused && t.pausedByBlur
              ? { ...t, paused: false, _startedAt: Date.now(), pausedByBlur: false }
              : t,
          )
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [removeToast])

  const addToast = useCallback(
    (message, { type = 'info', duration } = {}) => {
      const resolvedDuration = (duration || 4) * 1000
      const id = crypto.randomUUID()
      const isHidden = document.hidden
      const toast = {
        id,
        message,
        type,
        _remaining: resolvedDuration,
        _startedAt: Date.now(),
        paused: isHidden,
        pausedByBlur: isHidden,
        exiting: false,
      }
      setToasts((prev) => {
        if (!isHidden) {
          const timerId = setTimeout(() => removeToast(id), resolvedDuration)
          timersRef.current[id] = timerId
        }
        let next = [toast, ...prev]
        if (next.length > MAX_VISIBLE) {
          const evicted = next[MAX_VISIBLE]
          clearTimeout(timersRef.current[evicted.id])
          delete timersRef.current[evicted.id]
          next = next.slice(0, MAX_VISIBLE)
        }
        return next
      })
      return id
    },
    [removeToast],
  )

  const value = useMemo(
    () => ({ toasts, addToast, removeToast, pauseToast, resumeToast, togglePause }),
    [toasts, addToast, removeToast, pauseToast, resumeToast, togglePause],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastBridge />
    </ToastContext.Provider>
  )
}

function ToastBridge() {
  const { addToast } = useContext(ToastContext)

  useEffect(() => {
    function handler(e) {
      addToast(e.detail.message, { type: e.detail.type, duration: e.detail.duration })
    }
    window.addEventListener('show-toast', handler)
    return () => window.removeEventListener('show-toast', handler)
  }, [addToast])

  return null
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
