import { useRef, useEffect, useCallback } from 'react'

function autoResize(el) {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

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
