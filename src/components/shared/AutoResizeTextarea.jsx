import { useRef, useEffect, useCallback, forwardRef } from 'react'
import { autoResize } from '../../lib/autoResizeTextarea'

const AutoResizeTextarea = forwardRef(function AutoResizeTextarea(props, forwardedRef) {
  const { extraHeight = 0, value, onInput, ...rest } = props
  const innerRef = useRef(null)

  const setRef = useCallback(
    (node) => {
      innerRef.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef],
  )

  useEffect(() => {
    if (innerRef.current) autoResize(innerRef.current, { adjustScroll: false, extraHeight })
  }, [value, extraHeight])

  const handleInput = useCallback(
    (e) => {
      autoResize(e.target, { adjustScroll: true, extraHeight })
      onInput?.(e)
    },
    [onInput, extraHeight],
  )

  return <textarea ref={setRef} value={value} onInput={handleInput} {...rest} />
})

export default AutoResizeTextarea
