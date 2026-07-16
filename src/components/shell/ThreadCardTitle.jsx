import { useRef, useState, useLayoutEffect } from 'react'
import MarkdownTitle from '../shared/MarkdownTitle'

export default function ThreadCardTitle({ title, isActive, threadCardMarquee }) {
  const wrapperRef = useRef(null)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = wrapperRef.current
    if (el && threadCardMarquee) {
      const overflows = el.scrollWidth > el.clientWidth
      if (overflows) {
        el.style.setProperty('--marquee-distance', `-${el.scrollWidth - el.clientWidth}px`)
      }
      setOverflows(overflows)
    } else {
      setOverflows(false)
    }
  }, [title, threadCardMarquee])

  if (!threadCardMarquee) {
    return (
      <span className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-text'}`}>
        <MarkdownTitle>{title}</MarkdownTitle>
      </span>
    )
  }

  return (
    <span
      ref={wrapperRef}
      className={`text-sm font-medium marquee-wrapper ${overflows ? 'marquee-animate' : ''} ${isActive ? 'text-primary' : 'text-text'}`}
    >
      <span className="marquee-text">
        <MarkdownTitle>{title}</MarkdownTitle>
      </span>
    </span>
  )
}
