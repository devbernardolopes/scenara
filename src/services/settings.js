import i18n from '../lib/i18n'
import db from '../db'

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

export function applySettingEffect(key, value) {
  SETTING_EFFECTS[key]?.(value)
}

export const CATEGORIES = [
  { id: 'appearance', labelKey: 'settings:categories.appearance' },
  { id: 'api', labelKey: 'settings:categories.api' },
  { id: 'chat', labelKey: 'settings:categories.chat' },
  { id: 'prompting', labelKey: 'settings:categories.prompting' },
  { id: 'persona', labelKey: 'settings:categories.persona' },
  { id: 'tts', labelKey: 'settings:categories.tts' },
  { id: 'advanced', labelKey: 'settings:categories.advanced' },
]

export const SETTINGS = [
  {
    key: 'theme',
    category: 'appearance',
    type: 'select',
    default: 'light',
    options: ['light', 'dark', 'sepia', 'pastel', 'high-contrast'],
    labelKey: 'settings:appearance.theme.label',
    descKey: 'settings:appearance.theme.desc',
    optionLabels: {
      light: 'settings:themeOptions.light',
      dark: 'settings:themeOptions.dark',
      sepia: 'settings:themeOptions.sepia',
      pastel: 'settings:themeOptions.pastel',
      'high-contrast': 'settings:themeOptions.highContrast',
    },
  },
  {
    key: 'cardsPerPage',
    category: 'appearance',
    type: 'select',
    default: 10,
    options: [5, 10, 25, 50],
    labelKey: 'settings:appearance.cardsPerPage.label',
    descKey: 'settings:appearance.cardsPerPage.desc',
  },
  {
    key: 'language',
    category: 'appearance',
    type: 'select',
    default: 'en',
    options: ['en', 'pt-BR', 'fr', 'it', 'de', 'es'],
    labelKey: 'settings:appearance.language.label',
    descKey: 'settings:appearance.language.desc',
    optionLabels: {
      en: 'settings:languageOptions.en',
      'pt-BR': 'settings:languageOptions.pt-BR',
      fr: 'settings:languageOptions.fr',
      it: 'settings:languageOptions.it',
      de: 'settings:languageOptions.de',
      es: 'settings:languageOptions.es',
    },
  },
]

const SETTING_EFFECTS = {
  theme: (value) => applyThemeClass(value),
  language: (value) => i18n.changeLanguage(value),
}

export async function getSetting(key) {
  const rows = await db.settings.where('key').equals(key).toArray()
  const def = SETTINGS.find((s) => s.key === key)?.default
  if (rows.length > 1) {
    const keep = rows[rows.length - 1]
    await db.settings.bulkDelete(rows.filter((r) => r.id !== keep.id).map((r) => r.id))
    return keep.value ?? def ?? null
  }
  return rows[0]?.value ?? def ?? null
}

export async function setSetting(key, value) {
  const existing = await db.settings.where('key').equals(key).first()
  if (existing) {
    await db.settings.update(existing.id, { value })
  } else {
    await db.settings.add({ key, value })
  }
  SETTING_EFFECTS[key]?.(value)
  window.dispatchEvent(new CustomEvent('settings-changed', { detail: { key } }))
}
