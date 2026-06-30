import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getSetting, setSetting } from '../services/settings'

const ThemeContext = createContext(null)

function applyThemeClass(theme) {
  const html = document.documentElement
  html.className = html.className
    .split(' ')
    .filter((c) => !c.startsWith('theme-'))
    .join(' ')
  if (theme !== 'light') {
    html.classList.add(`theme-${theme}`)
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light')

  useEffect(() => {
    getSetting('theme').then((val) => {
      const t = val || 'light'
      applyThemeClass(t)
      setThemeState(t)
    })
  }, [])

  const setTheme = useCallback((val) => {
    applyThemeClass(val)
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
