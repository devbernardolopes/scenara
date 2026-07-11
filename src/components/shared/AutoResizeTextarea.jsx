import { useRef, useEffect, useCallback, forwardRef } from 'react'
import { autoResize } from '../../lib/autoResizeTextarea'

const AutoResizeTextarea = forwardRef(function AutoResizeTextarea(props, forwardedRef) {
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
    if (innerRef.current) autoResize(innerRef.current, { adjustScroll: false })
  }, [props.value])

  const handleInput = useCallback(
    (e) => {
      autoResize(e.target, { adjustScroll: true })
      props.onInput?.(e)
    },
    [props.onInput],
  )

  return <textarea ref={setRef} {...props} onInput={handleInput} />
})

export default AutoResizeTextarea
