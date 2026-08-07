import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from '../locales/en/common.json'
import enChat from '../locales/en/chat.json'
import enSettings from '../locales/en/settings.json'
import enCharacterCreation from '../locales/en/characterCreation.json'
import enLogs from '../locales/en/logs.json'

import ptCommon from '../locales/pt-BR/common.json'
import ptChat from '../locales/pt-BR/chat.json'
import ptSettings from '../locales/pt-BR/settings.json'
import ptCharacterCreation from '../locales/pt-BR/characterCreation.json'
import ptLogs from '../locales/pt-BR/logs.json'

import frCommon from '../locales/fr/common.json'
import frChat from '../locales/fr/chat.json'
import frSettings from '../locales/fr/settings.json'
import frCharacterCreation from '../locales/fr/characterCreation.json'
import frLogs from '../locales/fr/logs.json'

import itCommon from '../locales/it/common.json'
import itChat from '../locales/it/chat.json'
import itSettings from '../locales/it/settings.json'
import itCharacterCreation from '../locales/it/characterCreation.json'
import itLogs from '../locales/it/logs.json'

import deCommon from '../locales/de/common.json'
import deChat from '../locales/de/chat.json'
import deSettings from '../locales/de/settings.json'
import deCharacterCreation from '../locales/de/characterCreation.json'
import deLogs from '../locales/de/logs.json'

import esCommon from '../locales/es/common.json'
import esChat from '../locales/es/chat.json'
import esSettings from '../locales/es/settings.json'
import esCharacterCreation from '../locales/es/characterCreation.json'
import esLogs from '../locales/es/logs.json'

i18n.use(initReactI18next).init({
  debug: false,
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'chat', 'settings', 'characterCreation', 'logs'],
  resources: {
    en: {
      common: enCommon,
      chat: enChat,
      settings: enSettings,
      characterCreation: enCharacterCreation,
      logs: enLogs,
    },
    'pt-BR': {
      common: ptCommon,
      chat: ptChat,
      settings: ptSettings,
      characterCreation: ptCharacterCreation,
      logs: ptLogs,
    },
    fr: {
      common: frCommon,
      chat: frChat,
      settings: frSettings,
      characterCreation: frCharacterCreation,
      logs: frLogs,
    },
    it: {
      common: itCommon,
      chat: itChat,
      settings: itSettings,
      characterCreation: itCharacterCreation,
      logs: itLogs,
    },
    de: {
      common: deCommon,
      chat: deChat,
      settings: deSettings,
      characterCreation: deCharacterCreation,
      logs: deLogs,
    },
    es: {
      common: esCommon,
      chat: esChat,
      settings: esSettings,
      characterCreation: esCharacterCreation,
      logs: esLogs,
    },
  },
  interpolation: {
    escapeValue: false,
  },
})

const SUPPORTED_BASE = ['en', 'fr', 'it', 'de', 'es']

export function resolveSystemLocale() {
  if (typeof navigator === 'undefined') return 'en'
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const tag of tags) {
    const norm = String(tag || '')
      .replace('_', '-')
      .toLowerCase()
    if (norm === 'pt-br') return 'pt-BR'
    if (SUPPORTED_BASE.includes(norm)) return norm
    if (norm.startsWith('pt-')) return 'pt-BR'
    if (norm.startsWith('en-')) return 'en'
  }
  return 'en'
}

export function resolveLanguage(pref) {
  if (pref === 'system') return resolveSystemLocale()
  return pref || 'en'
}

export default i18n
