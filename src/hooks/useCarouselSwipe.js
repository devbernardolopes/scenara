import { useEffect, useRef } from 'react'

const ANIMATION_MS = 200
const STALE_TIMEOUT_MS = ANIMATION_MS * 3
const INTENT_THRESHOLD = 5
const VERTICAL_ABANDON_THRESHOLD = 20

export function useCarouselSwipe(
  trackRef,
  { enabled = true, threshold = 50, onSwipeLeft, onSwipeRight } = {},
) {
  const startRef = useRef(null)
  const isAnimating = useRef(false)
  const animStartRef = useRef(null)
  const onSwipeLeftRef = useRef(onSwipeLeft)
  const onSwipeRightRef = useRef(onSwipeRight)
  const activeListeners = useRef([])

  useEffect(() => {
    onSwipeLeftRef.current = onSwipeLeft
    onSwipeRightRef.current = onSwipeRight
  })

  useEffect(() => {
    if (enabled) {
      isAnimating.current = false
      animStartRef.current = null
    }
  }, [enabled])

  useEffect(() => {
    const el = trackRef.current
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
      animStartRef.current = null
    }

    function handleTouchStart(e) {
      if (e.touches.length > 1) return
      if (isAnimating.current) {
        if (animStartRef.current && Date.now() - animStartRef.current > STALE_TIMEOUT_MS) {
          resetDragState()
        } else {
          return
        }
      }
      startRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
    }

    function handleTouchMove(e) {
      if (!startRef.current || e.touches.length > 1) return
      const dx = e.touches[0].clientX - startRef.current.x
      const dy = e.touches[0].clientY - startRef.current.y
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      if (absDy > absDx && absDy > VERTICAL_ABANDON_THRESHOLD) {
        startRef.current = null
        el.style.transition = 'none'
        el.style.transform = 'translateX(-100%)'
        return
      }

      if (absDx > INTENT_THRESHOLD && absDx > absDy) {
        e.preventDefault()
        el.style.transition = 'none'
        el.style.transform = `translateX(calc(-100% + ${dx}px))`
      }
    }

    function handleTouchEnd(e) {
      if (!startRef.current) return
      const dx = e.changedTouches[0].clientX - startRef.current.x
      const dy = e.changedTouches[0].clientY - startRef.current.y
      startRef.current = null

      const currentTransform = el.style.transform
      const snapTarget = 'translateX(-100%)'

      if (Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) <= threshold) {
        if (currentTransform && currentTransform !== 'none' && currentTransform !== snapTarget) {
          el.style.transition = `transform ${ANIMATION_MS}ms ease-out`
          el.style.transform = snapTarget
          const onEnd = () => {
            el.removeEventListener('transitionend', onEnd)
            activeListeners.current = activeListeners.current.filter((l) => l.fn !== onEnd)
            el.style.transition = 'none'
            el.style.transform = snapTarget
          }
          el.addEventListener('transitionend', onEnd)
          activeListeners.current.push({ type: 'transitionend', fn: onEnd })
        }
        return
      }

      const direction = dx > 0 ? 'right' : 'left'
      const target = direction === 'left' ? 'translateX(-200%)' : 'translateX(0%)'
      const callback = direction === 'left' ? onSwipeLeftRef.current : onSwipeRightRef.current

      isAnimating.current = true
      animStartRef.current = Date.now()
      el.style.transition = `transform ${ANIMATION_MS}ms ease-out`
      el.style.transform = target

      const onSnap = () => {
        el.removeEventListener('transitionend', onSnap)
        activeListeners.current = activeListeners.current.filter((l) => l.fn !== onSnap)

        el.style.transition = 'none'
        el.style.transform = snapTarget
        callback?.()
        isAnimating.current = false
        animStartRef.current = null
      }
      el.addEventListener('transitionend', onSnap)
      activeListeners.current.push({ type: 'transitionend', fn: onSnap })
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
  }, [trackRef, enabled, threshold])
}
