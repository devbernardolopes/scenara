import { useState, useEffect, useRef, useCallback } from 'react'
import { getEffectiveProfileFor } from '../services/connectionProfiles'
import { fetchModels } from '../services/modelFetcher'

const POLL_INTERVAL_MS = 15000

function formatEta(seconds) {
  if (seconds >= 60) {
    const mins = Math.round(seconds / 60)
    return `${mins}m`
  }
  return `${Math.round(seconds)}s`
}

export function useHordeEta(enabled) {
  const [eta, setEta] = useState(null)
  const abortRef = useRef(null)
  const timerRef = useRef(null)
  const providerRef = useRef(null)
  const modelRef = useRef(null)
  const activeRef = useRef(false)

  const fetchEta = useCallback(async () => {
    if (providerRef.current !== 'ai-horde' || !modelRef.current) {
      setEta(null)
      return
    }

    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    try {
      const result = await fetchModels('ai-horde', { signal: abortRef.current.signal })
      const modelEta = result.meta?.[modelRef.current]?.eta
      setEta(typeof modelEta === 'number' ? formatEta(modelEta) : '--')
    } catch {
      setEta('--')
    } finally {
      if (activeRef.current) {
        timerRef.current = setTimeout(fetchEta, POLL_INTERVAL_MS)
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setEta(null)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }
      return
    }

    activeRef.current = true

    async function load() {
      const profile = await getEffectiveProfileFor('chat')
      if (!activeRef.current) return

      providerRef.current = profile?.providerId || null
      modelRef.current = profile?.model || null

      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (abortRef.current) {
        abortRef.current.abort()
        abortRef.current = null
      }

      if (profile?.providerId === 'ai-horde') {
        fetchEta()
      } else {
        setEta(null)
      }
    }

    load()

    function onSettingsChanged(e) {
      if (e.detail?.key === 'requestKind.chat.profileId') load()
    }
    window.addEventListener('settings-changed', onSettingsChanged)

    return () => {
      activeRef.current = false
      window.removeEventListener('settings-changed', onSettingsChanged)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [enabled, fetchEta])

  return eta
}
