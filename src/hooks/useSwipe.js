import { useEffect, useRef } from 'react'

const ANIMATION_MS = 200

export function useSwipe(ref, { onSwipeLeft, onSwipeRight, enabled = true, threshold = 50 }) {
  const startRef = useRef(null)
  const isAnimating = useRef(false)
  const onSwipeLeftRef = useRef(onSwipeLeft)
  const onSwipeRightRef = useRef(onSwipeRight)
  const activeListeners = useRef([])

  useEffect(() => {
    onSwipeLeftRef.current = onSwipeLeft
    onSwipeRightRef.current = onSwipeRight
  })

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    function cleanupTransitionListeners() {
      for (const { type, fn } of activeListeners.current) {
        el.removeEventListener(type, fn)
      }
      activeListeners.current = []
    }

    function resetDragState() {
      cleanupTransitionListeners()
      el.style.transition = 'none'
      el.style.transform = ''
      isAnimating.current = false
    }

    function handleTouchStart(e) {
      if (e.touches.length > 1 || isAnimating.current) return
      startRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
    }

    function handleTouchMove(e) {
      if (!startRef.current || e.touches.length > 1) return
      const dx = e.touches[0].clientX - startRef.current.x
      const dy = e.touches[0].clientY - startRef.current.y

      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
        startRef.current = null
        el.style.transition = 'none'
        el.style.transform = ''
        return
      }

      if (Math.abs(dx) > threshold) {
        e.preventDefault()
        el.style.transition = 'none'
        el.style.transform = `translateX(${dx}px)`
      }
    }

    function handleTouchEnd(e) {
      if (!startRef.current) return
      const dx = e.changedTouches[0].clientX - startRef.current.x
      const dy = e.changedTouches[0].clientY - startRef.current.y
      startRef.current = null

      if (Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) <= threshold) {
        if (el.style.transform && el.style.transform !== 'none') {
          el.style.transition = `transform ${ANIMATION_MS}ms ease-out`
          el.style.transform = 'translateX(0)'
          const onEnd = () => {
            el.removeEventListener('transitionend', onEnd)
            activeListeners.current = activeListeners.current.filter((l) => l.fn !== onEnd)
            el.style.transition = 'none'
            el.style.transform = ''
          }
          el.addEventListener('transitionend', onEnd)
          activeListeners.current.push({ type: 'transitionend', fn: onEnd })
        }
        return
      }

      const direction = dx > 0 ? 'right' : 'left'
      const offscreen = direction === 'left' ? '-100%' : '100%'
      const entranceFrom = direction === 'left' ? '100%' : '-100%'
      const callback = direction === 'left' ? onSwipeLeftRef.current : onSwipeRightRef.current

      isAnimating.current = true
      el.style.transition = `transform ${ANIMATION_MS}ms ease-out`
      el.style.transform = `translateX(${offscreen})`

      const onPhase1 = () => {
        el.removeEventListener('transitionend', onPhase1)
        activeListeners.current = activeListeners.current.filter((l) => l.fn !== onPhase1)

        callback?.()

        requestAnimationFrame(() => {
          el.style.transition = 'none'
          el.style.transform = `translateX(${entranceFrom})`

          requestAnimationFrame(() => {
            el.style.transition = `transform ${ANIMATION_MS}ms ease-out`
            el.style.transform = 'translateX(0)'

            const onPhase2 = () => {
              el.removeEventListener('transitionend', onPhase2)
              activeListeners.current = activeListeners.current.filter((l) => l.fn !== onPhase2)
              el.style.transition = 'none'
              el.style.transform = ''
              isAnimating.current = false
            }
            el.addEventListener('transitionend', onPhase2)
            activeListeners.current.push({ type: 'transitionend', fn: onPhase2 })
          })
        })
      }
      el.addEventListener('transitionend', onPhase1)
      activeListeners.current.push({ type: 'transitionend', fn: onPhase1 })
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      resetDragState()
      startRef.current = null
    }
  }, [ref, enabled, threshold])
}
