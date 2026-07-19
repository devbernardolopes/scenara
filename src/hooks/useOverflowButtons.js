import { useState, useEffect, useRef, useMemo, useCallback } from 'react'

function getContentWidth(containerEl) {
  let width = 0
  const children = containerEl.children
  for (let i = 0; i < children.length; i++) {
    width += children[i].offsetWidth
    if (i < children.length - 1) {
      const next = children[i + 1]
      width += next.offsetLeft - (children[i].offsetLeft + children[i].offsetWidth)
    }
  }
  return width
}

// Measure the real geometry of the rendered row instead of guessing, so the
// fit math is exact regardless of each caller's gap / button size.
function measureGeometry(containerEl, fallbackGapPx, fallbackButtonWidthPx) {
  const children = containerEl.children
  if (children.length === 0) {
    return { gapPx: fallbackGapPx, buttonWidthPx: fallbackButtonWidthPx }
  }
  const first = children[0]
  const buttonWidthPx = first.offsetWidth || fallbackButtonWidthPx
  let gapPx = fallbackGapPx
  if (children.length > 1) {
    const second = children[1]
    const measured = second.offsetLeft - (first.offsetLeft + first.offsetWidth)
    if (measured > 0) gapPx = measured
  }
  return { gapPx, buttonWidthPx }
}

export function useOverflowButtons(
  allButtonKeys,
  { gapPx: gapPxArg = 2, buttonWidthPx: buttonWidthPxArg = 46 } = {},
) {
  const [headerCount, setHeaderCount] = useState(allButtonKeys.length)
  const headerBtnRef = useRef(null)
  const allBtnKeyRef = useRef(allButtonKeys)
  const headerCountRef = useRef(headerCount)
  const prevKeyStrRef = useRef('')

  useEffect(() => {
    allBtnKeyRef.current = allButtonKeys
  }, [allButtonKeys])

  useEffect(() => {
    headerCountRef.current = headerCount
  }, [headerCount])

  useEffect(() => {
    const keyStr = allButtonKeys.join(',')
    if (keyStr !== prevKeyStrRef.current) {
      prevKeyStrRef.current = keyStr
      setHeaderCount(allButtonKeys.length)
    }
  }, [allButtonKeys])

  const adjust = useCallback(() => {
    const el = headerBtnRef.current
    if (!el) return
    const total = allBtnKeyRef.current.length
    const currentCount = headerCountRef.current
    const { gapPx, buttonWidthPx } = measureGeometry(el, gapPxArg, buttonWidthPxArg)
    const contentWidth = getContentWidth(el)

    if (contentWidth > el.clientWidth) {
      if (currentCount > 0) {
        setHeaderCount((n) => Math.max(0, n - 1))
      }
    } else if (currentCount < total) {
      const perBtn = buttonWidthPx + gapPx
      const remaining = total - currentCount
      // The More button occupies space but vanishes once the overflow
      // becomes empty, so credit it when deciding whether all remaining
      // buttons fit back into the header.
      const fitsAll = contentWidth - buttonWidthPx + remaining * perBtn <= el.clientWidth
      if (fitsAll) {
        setHeaderCount(total)
      } else {
        const free = el.clientWidth - contentWidth
        const addPlain = Math.floor(free / perBtn)
        if (addPlain > 0) {
          setHeaderCount((n) => Math.min(total, n + addPlain))
        }
      }
    }
  }, [gapPxArg, buttonWidthPxArg])

  useEffect(() => {
    const el = headerBtnRef.current
    if (!el || allButtonKeys.length <= 1) return

    const ro = new ResizeObserver(() => requestAnimationFrame(adjust))
    ro.observe(el)
    requestAnimationFrame(adjust)
    return () => ro.disconnect()
  }, [allButtonKeys, adjust])

  useEffect(() => {
    const el = headerBtnRef.current
    if (!el || allButtonKeys.length <= 1) return
    const raf = requestAnimationFrame(adjust)
    return () => cancelAnimationFrame(raf)
  }, [headerCount, allButtonKeys, adjust])

  const headerKeys = useMemo(
    () => allButtonKeys.slice(0, headerCount),
    [allButtonKeys, headerCount],
  )
  const overflowKeys = useMemo(
    () => allButtonKeys.slice(headerKeys.length),
    [allButtonKeys, headerKeys],
  )

  return { headerBtnRef, headerKeys, overflowKeys }
}
