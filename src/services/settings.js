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
  { id: 'defaults', labelKey: 'settings:categories.defaults' },
  { id: 'prompting', labelKey: 'settings:categories.prompting' },
  { id: 'tts', labelKey: 'settings:categories.tts' },
  { id: 'advanced', labelKey: 'settings:categories.advanced' },
  { id: 'database', labelKey: 'settings:categories.database' },
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
  {
    key: 'toastPosition',
    category: 'appearance',
    type: 'select',
    default: 'top-right',
    options: [
      'top-right',
      'top-left',
      'top-center',
      'bottom-right',
      'bottom-left',
      'bottom-center',
    ],
    labelKey: 'settings:appearance.toastPosition.label',
    descKey: 'settings:appearance.toastPosition.desc',
    optionLabels: {
      'top-right': 'settings:toastPositionOptions.top-right',
      'top-left': 'settings:toastPositionOptions.top-left',
      'top-center': 'settings:toastPositionOptions.top-center',
      'bottom-right': 'settings:toastPositionOptions.bottom-right',
      'bottom-left': 'settings:toastPositionOptions.bottom-left',
      'bottom-center': 'settings:toastPositionOptions.bottom-center',
    },
  },
  {
    key: 'toastDuration',
    category: 'appearance',
    type: 'slider',
    default: 4,
    props: { min: 2, max: 15, step: 1 },
    labelKey: 'settings:appearance.toastDuration.label',
    descKey: 'settings:appearance.toastDuration.desc',
  },
  {
    key: 'defaultAutoTitle',
    category: 'defaults',
    type: 'toggle',
    default: true,
    labelKey: 'settings:defaults.autoTitle.label',
    descKey: 'settings:defaults.autoTitle.desc',
  },
  {
    key: 'defaultAutoTitleThreshold',
    category: 'defaults',
    type: 'text',
    default: 3,
    props: { type: 'number' },
    labelKey: 'settings:defaults.autoTitleThreshold.label',
    descKey: 'settings:defaults.autoTitleThreshold.desc',
  },
  {
    key: 'defaultMemory',
    category: 'defaults',
    type: 'toggle',
    default: true,
    labelKey: 'settings:defaults.memory.label',
    descKey: 'settings:defaults.memory.desc',
  },
  {
    key: 'defaultMemoryThreshold',
    category: 'defaults',
    type: 'text',
    default: 7,
    props: { type: 'number' },
    labelKey: 'settings:defaults.memoryThreshold.label',
    descKey: 'settings:defaults.memoryThreshold.desc',
  },
  {
    key: 'defaultFirstMessage',
    category: 'defaults',
    type: 'toggle',
    default: true,
    labelKey: 'settings:defaults.firstMessage.label',
    descKey: 'settings:defaults.firstMessage.desc',
  },
  {
    key: 'defaultUserPersonaPrefix',
    category: 'defaults',
    type: 'toggle',
    default: true,
    labelKey: 'settings:defaults.userPersonaPrefix.label',
    descKey: 'settings:defaults.userPersonaPrefix.desc',
  },
  {
    key: 'defaultIncludeOOC',
    category: 'defaults',
    type: 'toggle',
    default: true,
    labelKey: 'settings:defaults.includeOOC.label',
    descKey: 'settings:defaults.includeOOC.desc',
  },
  {
    key: 'defaultPostProcessing',
    category: 'defaults',
    type: 'toggle',
    default: true,
    labelKey: 'settings:defaults.postProcessing.label',
    descKey: 'settings:defaults.postProcessing.desc',
  },
  {
    key: 'defaultCharacterAvatarScale',
    category: 'defaults',
    type: 'select',
    default: '1x',
    options: ['1x', '2x', '3x', '4x'],
    labelKey: 'settings:defaults.characterAvatarScale.label',
    descKey: 'settings:defaults.characterAvatarScale.desc',
  },
  {
    key: 'defaultUserPersonaAvatarScale',
    category: 'defaults',
    type: 'select',
    default: '1x',
    options: ['1x', '2x', '3x', '4x'],
    labelKey: 'settings:defaults.userPersonaAvatarScale.label',
    descKey: 'settings:defaults.userPersonaAvatarScale.desc',
  },
  {
    key: 'requestKind.chat.profileId',
    category: 'api',
    type: 'text',
    default: null,
    labelKey: 'settings:api.chatProfile.label',
    descKey: 'settings:api.chatProfile.desc',
  },
  {
    key: 'requestKind.autoTitle.profileId',
    category: 'api',
    type: 'text',
    default: null,
    labelKey: 'settings:api.autoTitleProfile.label',
    descKey: 'settings:api.autoTitleProfile.desc',
  },
  {
    key: 'requestKind.summarization.profileId',
    category: 'api',
    type: 'text',
    default: null,
    labelKey: 'settings:api.summarizationProfile.label',
    descKey: 'settings:api.summarizationProfile.desc',
  },
  {
    key: 'requestKind.director.profileId',
    category: 'api',
    type: 'text',
    default: null,
    labelKey: 'settings:api.directorProfile.label',
    descKey: 'settings:api.directorProfile.desc',
  },
  {
    key: 'api.useChatForAll',
    category: 'api',
    type: 'text',
    default: null,
    labelKey: 'settings:api.useChatForAll.label',
    descKey: 'settings:api.useChatForAll.desc',
  },
  {
    key: 'api.requestCooldown',
    category: 'api',
    type: 'slider',
    default: 2,
    props: { min: 2, max: 10, step: 0.5 },
    labelKey: 'settings:api.requestCooldown.label',
    descKey: 'settings:api.requestCooldown.desc',
  },
  {
    key: 'prompting.autoTitleSystem',
    category: 'prompting',
    type: 'textarea',
    default: '',
    props: { rows: 6, collapsible: true, summary: 'tokens' },
    labelKey: 'settings:prompting.autoTitleSystem.label',
    descKey: 'settings:prompting.autoTitleSystem.desc',
  },
  {
    key: 'prompting.autoTitleUser',
    category: 'prompting',
    type: 'textarea',
    default: '',
    props: { rows: 6, collapsible: true, summary: 'tokens' },
    labelKey: 'settings:prompting.autoTitleUser.label',
    descKey: 'settings:prompting.autoTitleUser.desc',
  },
  {
    key: 'prompting.summarizationSystem',
    category: 'prompting',
    type: 'textarea',
    default: '',
    props: { rows: 6, collapsible: true, summary: 'tokens' },
    labelKey: 'settings:prompting.summarizationSystem.label',
    descKey: 'settings:prompting.summarizationSystem.desc',
  },
  {
    key: 'prompting.summarizationUser',
    category: 'prompting',
    type: 'textarea',
    default: '',
    props: { rows: 6, collapsible: true, summary: 'tokens' },
    labelKey: 'settings:prompting.summarizationUser.label',
    descKey: 'settings:prompting.summarizationUser.desc',
  },
  {
    key: 'prompting.oocSystem',
    category: 'prompting',
    type: 'textarea',
    default: '',
    props: { rows: 6, collapsible: true, summary: 'tokens' },
    labelKey: 'settings:prompting.oocSystem.label',
    descKey: 'settings:prompting.oocSystem.desc',
  },
  {
    key: 'prompting.oocUser',
    category: 'prompting',
    type: 'textarea',
    default: '',
    props: { rows: 6, collapsible: true, summary: 'tokens' },
    labelKey: 'settings:prompting.oocUser.label',
    descKey: 'settings:prompting.oocUser.desc',
  },
  {
    key: 'prompting.personaInjectionTemplate',
    category: 'prompting',
    type: 'textarea',
    default: '',
    props: { rows: 6, collapsible: true, summary: 'tokens' },
    labelKey: 'settings:prompting.personaInjectionTemplate.label',
    descKey: 'settings:prompting.personaInjectionTemplate.desc',
  },
  {
    key: 'prompting.oocMessageRole',
    category: 'prompting',
    type: 'select',
    default: 'system',
    options: ['system', 'assistant'],
    labelKey: 'settings:prompting.oocMessageRole.label',
    descKey: 'settings:prompting.oocMessageRole.desc',
    optionLabels: {
      system: 'settings:prompting.oocMessageRoleOptions.system',
      assistant: 'settings:prompting.oocMessageRoleOptions.assistant',
    },
  },
  {
    key: 'prompting.systemRolePrefix',
    category: 'prompting',
    type: 'text',
    default: '[SYSTEM]:',
    labelKey: 'settings:prompting.systemRolePrefix.label',
    descKey: 'settings:prompting.systemRolePrefix.desc',
  },
  {
    key: 'prompting.assistantRolePrefix',
    category: 'prompting',
    type: 'text',
    default: '[ASSISTANT]:',
    labelKey: 'settings:prompting.assistantRolePrefix.label',
    descKey: 'settings:prompting.assistantRolePrefix.desc',
  },
  {
    key: 'prompting.userRolePrefix',
    category: 'prompting',
    type: 'text',
    default: '[USER]:',
    labelKey: 'settings:prompting.userRolePrefix.label',
    descKey: 'settings:prompting.userRolePrefix.desc',
  },
  {
    key: 'prompting.userRolePrefixWithPersona',
    category: 'prompting',
    type: 'text',
    default: '[USER as {{persona_name}}]:',
    labelKey: 'settings:prompting.userRolePrefixWithPersona.label',
    descKey: 'settings:prompting.userRolePrefixWithPersona.desc',
  },
  {
    key: 'prompting.systemRolePrefixOoc',
    category: 'prompting',
    type: 'text',
    default: '[SYSTEM in OOC]:',
    labelKey: 'settings:prompting.systemRolePrefixOoc.label',
    descKey: 'settings:prompting.systemRolePrefixOoc.desc',
  },
  {
    key: 'prompting.assistantRolePrefixOoc',
    category: 'prompting',
    type: 'text',
    default: '[ASSISTANT in OOC]:',
    labelKey: 'settings:prompting.assistantRolePrefixOoc.label',
    descKey: 'settings:prompting.assistantRolePrefixOoc.desc',
  },
  {
    key: 'prompting.userRolePrefixOoc',
    category: 'prompting',
    type: 'text',
    default: '[USER in OOC]:',
    labelKey: 'settings:prompting.userRolePrefixOoc.label',
    descKey: 'settings:prompting.userRolePrefixOoc.desc',
  },
  {
    key: 'prompting.writingInjectionTiming',
    category: 'defaults',
    type: 'select',
    default: 'always',
    options: ['always'],
    labelKey: 'settings:defaults.writingInjectionTiming.label',
    descKey: 'settings:defaults.writingInjectionTiming.desc',
    optionLabels: {
      always: 'settings:defaults.writingInjectionTimingOptions.always',
    },
  },
  {
    key: 'prompting.writingPlacement',
    category: 'defaults',
    type: 'select',
    default: 'endOfSystemPrompt',
    options: ['endOfSystemPrompt', 'endOfMessages'],
    labelKey: 'settings:defaults.writingPlacement.label',
    descKey: 'settings:defaults.writingPlacement.desc',
    optionLabels: {
      endOfSystemPrompt: 'settings:defaults.writingPlacementOptions.endOfSystemPrompt',
      endOfMessages: 'settings:defaults.writingPlacementOptions.endOfMessages',
    },
  },
  {
    key: 'prompting.writingMessageRole',
    category: 'defaults',
    type: 'select',
    default: 'system',
    options: ['system', 'assistant'],
    dependsOn: { key: 'prompting.writingPlacement', value: 'endOfMessages' },
    labelKey: 'settings:defaults.writingMessageRole.label',
    descKey: 'settings:defaults.writingMessageRole.desc',
    optionLabels: {
      system: 'settings:defaults.writingMessageRoleOptions.system',
      assistant: 'settings:defaults.writingMessageRoleOptions.assistant',
    },
  },
  {
    key: 'personaInjectionPlacement',
    category: 'defaults',
    type: 'select',
    default: 'endOfSystemPrompt',
    options: ['endOfSystemPrompt', 'endOfMessages'],
    labelKey: 'settings:defaults.personaInjectionPlacement.label',
    descKey: 'settings:defaults.personaInjectionPlacement.desc',
    optionLabels: {
      endOfSystemPrompt: 'settings:defaults.personaInjectionPlacementOptions.endOfSystemPrompt',
      endOfMessages: 'settings:defaults.personaInjectionPlacementOptions.endOfMessages',
    },
  },
  {
    key: 'personaInjectionMessageRole',
    category: 'defaults',
    type: 'select',
    default: 'system',
    options: ['system', 'assistant'],
    dependsOn: { key: 'personaInjectionPlacement', value: 'endOfMessages' },
    labelKey: 'settings:defaults.personaInjectionMessageRole.label',
    descKey: 'settings:defaults.personaInjectionMessageRole.desc',
    optionLabels: {
      system: 'settings:defaults.personaInjectionMessageRoleOptions.system',
      assistant: 'settings:defaults.personaInjectionMessageRoleOptions.assistant',
    },
  },
  {
    key: 'prompting.firstMessageRole',
    category: 'prompting',
    type: 'select',
    default: 'system',
    options: ['system', 'assistant'],
    labelKey: 'settings:prompting.firstMessageRole.label',
    descKey: 'settings:prompting.firstMessageRole.desc',
    optionLabels: {
      system: 'settings:prompting.firstMessageRoleOptions.system',
      assistant: 'settings:prompting.firstMessageRoleOptions.assistant',
    },
  },
  {
    key: 'prompting.firstMessagePrompt',
    category: 'prompting',
    type: 'textarea',
    default: '',
    props: { rows: 6, collapsible: true, summary: 'tokens' },
    labelKey: 'settings:prompting.firstMessagePrompt.label',
    descKey: 'settings:prompting.firstMessagePrompt.desc',
  },
  {
    key: 'prompting.continueRole',
    category: 'prompting',
    type: 'select',
    default: 'system',
    options: ['system', 'assistant', 'user'],
    labelKey: 'settings:prompting.continueRole.label',
    descKey: 'settings:prompting.continueRole.desc',
    optionLabels: {
      system: 'settings:prompting.continueRoleOptions.system',
      assistant: 'settings:prompting.continueRoleOptions.assistant',
      user: 'settings:prompting.continueRoleOptions.user',
    },
  },
  {
    key: 'prompting.continuePrompt',
    category: 'prompting',
    type: 'textarea',
    default: '',
    props: { rows: 6, collapsible: true, summary: 'tokens' },
    labelKey: 'settings:prompting.continuePrompt.label',
    descKey: 'settings:prompting.continuePrompt.desc',
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
