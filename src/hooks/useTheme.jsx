import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import db from '../db'

const THEMES = ['light', 'dark', 'sepia', 'pastel', 'high-contrast']

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light')

  useEffect(() => {
    db.settings.where('key').equals('theme').first().then((row) => {
      if (row && THEMES.includes(row.value)) {
        applyTheme(row.value)
        setThemeState(row.value)
      }
    })
  }, [])

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return
    applyTheme(next)
    setThemeState(next)
    db.settings.put({ key: 'theme', value: next })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

function applyTheme(theme) {
  const html = document.documentElement
  html.className = html.className
    .split(' ')
    .filter((c) => !c.startsWith('theme-'))
    .join(' ')
  if (theme !== 'light') {
    html.classList.add(`theme-${theme}`)
  }
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
