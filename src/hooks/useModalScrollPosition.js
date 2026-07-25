import { useRef, useEffect, useCallback } from 'react'
import { getUIState, setUIState } from '../services/uiState'

export function useModalScrollPosition(key) {
  const scrollRef = useRef(null)
  const saveTimerRef = useRef(null)
  const keyRef = useRef(key)
  keyRef.current = key

  useEffect(() => {
    if (!scrollRef.current || !key) return
    const el = scrollRef.current
    getUIState(`scroll.${key}`).then((saved) => {
      if (saved && typeof saved.percent === 'number' && scrollRef.current) {
        requestAnimationFrame(() => {
          const max = el.scrollHeight - el.clientHeight
          if (max > 0) el.scrollTop = saved.percent * max
        })
      }
    })
  }, [key])

  const handleScroll = useCallback(() => {
    if (!keyRef.current) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const el = scrollRef.current
      if (!el) return
      const max = el.scrollHeight - el.clientHeight
      if (max > 0) {
        setUIState(`scroll.${keyRef.current}`, { percent: el.scrollTop / max })
      }
    }, 300)
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(saveTimerRef.current)
      const el = scrollRef.current
      if (!el || !keyRef.current) return
      const max = el.scrollHeight - el.clientHeight
      if (max > 0) {
        setUIState(`scroll.${keyRef.current}`, { percent: el.scrollTop / max })
      }
    }
  }, [])

  return { scrollRef, onScroll: handleScroll }
}
