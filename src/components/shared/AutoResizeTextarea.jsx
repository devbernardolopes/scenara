import { useRef, useEffect, useCallback } from 'react'
import { autoResize } from '../../lib/autoResizeTextarea'

export default function AutoResizeTextarea(props) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) autoResize(ref.current)
  }, [props.value])

  const handleInput = useCallback(
    (e) => {
      autoResize(e.target)
      props.onInput?.(e)
    },
    [props.onInput],
  )

  return <textarea ref={ref} {...props} onInput={handleInput} />
}
