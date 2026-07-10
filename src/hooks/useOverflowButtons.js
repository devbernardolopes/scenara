import { useState, useEffect, useRef, useMemo, useCallback } from 'react'

function getContentWidth(containerEl, gapPx) {
  let width = 0
  const children = containerEl.children
  for (let i = 0; i < children.length; i++) {
    width += children[i].offsetWidth
    if (i < children.length - 1) width += gapPx
  }
  return width
}

export function useOverflowButtons(allButtonKeys, { gapPx = 2, buttonWidthPx = 46 } = {}) {
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
    const contentWidth = getContentWidth(el, gapPx)

    if (contentWidth > el.clientWidth) {
      if (currentCount > 1) {
        setHeaderCount((n) => Math.max(1, n - 1))
      }
    } else if (currentCount < total) {
      const free = el.clientWidth - contentWidth
      const canFit = Math.floor(free / buttonWidthPx)
      if (canFit > 0) {
        setHeaderCount((n) => Math.min(total, n + canFit))
      }
    }
  }, [gapPx, buttonWidthPx])

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
