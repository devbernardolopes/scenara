import { useRef, useState, useLayoutEffect } from 'react'

export default function MarqueeText({ children, marquee = true, className = '' }) {
  const wrapperRef = useRef(null)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = wrapperRef.current
    if (el && marquee) {
      const overflows = el.scrollWidth > el.clientWidth
      if (overflows) {
        el.style.setProperty('--marquee-distance', `-${el.scrollWidth - el.clientWidth}px`)
      }
      setOverflows(overflows)
    } else {
      setOverflows(false)
    }
  }, [children, marquee])

  if (!marquee) {
    return <span className={`truncate ${className}`}>{children}</span>
  }

  return (
    <span
      ref={wrapperRef}
      className={`marquee-wrapper ${overflows ? 'marquee-animate' : ''} ${className}`}
    >
      <span className="marquee-text">{children}</span>
    </span>
  )
}
