import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getSetting, setSetting } from '../services/settings'

const LocaleContext = createContext(null)

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState('en')

  useEffect(() => {
    getSetting('language').then((val) => setLocaleState(val || 'en'))
  }, [])

  const setLocale = useCallback((val) => {
    setLocaleState(val)
    setSetting('language', val)
  }, [])

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider')
  return ctx
}
