import db from '../db'

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

export async function getSetting(key) {
  const row = await db.settings.where('key').equals(key).first()
  const def = SETTINGS.find((s) => s.key === key)?.default
  return row?.value ?? def ?? null
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value })
}
