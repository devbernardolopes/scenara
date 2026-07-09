import { useEffect, useRef } from 'react'

export function useSwipe(ref, { onSwipeLeft, onSwipeRight, enabled = true, threshold = 50 }) {
  const startRef = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    function handleTouchStart(e) {
      if (e.touches.length > 1) return
      startRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
    }

    function handleTouchMove(e) {
      if (!startRef.current || e.touches.length > 1) return
      const dx = e.touches[0].clientX - startRef.current.x
      const dy = e.touches[0].clientY - startRef.current.y

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        e.preventDefault()
      }
    }

    function handleTouchEnd(e) {
      if (!startRef.current) return
      const dx = e.changedTouches[0].clientX - startRef.current.x
      const dy = e.changedTouches[0].clientY - startRef.current.y

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        if (dx > 0) {
          onSwipeRight?.()
        } else {
          onSwipeLeft?.()
        }
      }

      startRef.current = null
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [ref, enabled, onSwipeLeft, onSwipeRight, threshold])
}
