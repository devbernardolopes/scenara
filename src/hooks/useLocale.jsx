import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getSetting, setSetting, applySettingEffect } from '../services/settings'
import { resolveLanguage } from '../lib/i18n'

const LocaleContext = createContext(null)

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState('en')

  const applyStoredLocale = useCallback(() => {
    getSetting('language').then((val) => {
      const resolved = resolveLanguage(val)
      setLocaleState(resolved)
      applySettingEffect('language', resolved)
    })
  }, [])

  useEffect(() => {
    applyStoredLocale()
    window.addEventListener('languagechange', applyStoredLocale)
    return () => window.removeEventListener('languagechange', applyStoredLocale)
  }, [applyStoredLocale])

  const setLocale = useCallback((val) => {
    setLocaleState(resolveLanguage(val))
    setSetting('language', val)
  }, [])

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider')
  return ctx
}
