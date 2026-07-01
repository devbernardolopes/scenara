import { useState, useEffect, useCallback } from 'react'
import { getUIState, setUIState } from '../services/uiState'

export function usePersistedState(key, defaultValue) {
  const [value, setValue] = useState(defaultValue)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
    getUIState(key).then((val) => {
      if (val !== null && val !== undefined) {
        setValue(val)
      }
      setLoaded(true)
    })
  }, [key])

  const setAndPersist = useCallback(
    (next) => {
      setValue(next)
      setUIState(key, next)
    },
    [key],
  )

  return [value, setAndPersist, loaded]
}
