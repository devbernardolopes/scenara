import { useState, useEffect, useRef } from 'react'
import { getEffectiveProfileFor } from '../services/connectionProfiles'

const POLL_INTERVAL_MS = 15000
const HORDE_MODELS_BASE = 'https://stablehorde.net/api/v2/status/models'

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

  const fetchEtaRef = useRef(null)

  useEffect(() => {
    if (!enabled) {
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

    async function fetchEta() {
      if (providerRef.current !== 'ai-horde' || !modelRef.current) {
        setEta(null)
        return
      }

      if (abortRef.current) abortRef.current.abort()
      abortRef.current = new AbortController()

      try {
        const encoded = encodeURIComponent(modelRef.current)
        const res = await fetch(`${HORDE_MODELS_BASE}/${encoded}`, {
          signal: abortRef.current.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setEta(typeof data.eta === 'number' ? formatEta(data.eta) : '--')
      } catch {
        setEta('--')
      } finally {
        if (activeRef.current) {
          timerRef.current = setTimeout(fetchEtaRef.current, POLL_INTERVAL_MS)
        }
      }
    }

    fetchEtaRef.current = fetchEta

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
        fetchEtaRef.current?.()
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
  }, [enabled])

  return eta
}
