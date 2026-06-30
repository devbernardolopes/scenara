import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import i18n from '../lib/i18n'
import { getSetting, setSetting } from '../services/settings'

const LocaleContext = createContext(null)

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState('en')

  useEffect(() => {
    getSetting('language').then((val) => {
      const l = val || 'en'
      i18n.changeLanguage(l)
      setLocaleState(l)
    })
  }, [])

  const setLocale = useCallback((val) => {
    i18n.changeLanguage(val)
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
