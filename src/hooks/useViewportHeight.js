import { useEffect } from 'react'

export function useViewportHeight() {
  useEffect(() => {
    function setHeight() {
      const height = window.visualViewport?.height ?? window.innerHeight
      document.documentElement.style.setProperty('--app-height', `${height}px`)
    }

    setHeight()

    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', setHeight)
      vv.addEventListener('scroll', setHeight)
    } else {
      window.addEventListener('resize', setHeight)
    }

    return () => {
      if (vv) {
        vv.removeEventListener('resize', setHeight)
        vv.removeEventListener('scroll', setHeight)
      } else {
        window.removeEventListener('resize', setHeight)
      }
    }
  }, [])
}