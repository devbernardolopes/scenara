import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  resolveThemeSetting,
  getSetting,
  setSetting,
  applySettingEffect,
} from '../services/settings'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light')

  useEffect(() => {
    resolveThemeSetting().then((resolved) => {
      setThemeState(resolved)
      applySettingEffect('theme', resolved)
    })
    getSetting('highlightDeleteButtons').then((val) => {
      applySettingEffect('highlightDeleteButtons', val ?? false)
    })
  }, [])

  const setTheme = useCallback((val) => {
    setThemeState(val)
    setSetting('theme', val)
  }, [])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
