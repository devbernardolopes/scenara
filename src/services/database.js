import db from '../db'
import { SETTINGS, applySettingEffect } from './settings'

export async function resetDatabase() {
  await db.threads.clear()
  await db.characters.clear()
  await db.personas.clear()
  await db.settings.clear()
  await db.uiState.clear()
  await db.messages.clear()
  await db.writingInstructions.clear()

  for (const setting of SETTINGS) {
    await db.settings.add({ key: setting.key, value: setting.default })
  }

  applySettingEffect('theme', SETTINGS.find((s) => s.key === 'theme').default)
  applySettingEffect('language', SETTINGS.find((s) => s.key === 'language').default)

  const now = new Date()
  const personaId = await db.personas.add({
    name: 'Anon',
    title: '',
    avatar: '',
    description: '',
    context: '',
    color: '',
    isDefault: 1,
    createdAt: now,
    updatedAt: now,
  })

  await db.settings.add({ key: 'defaultPersonaId', value: personaId })

  window.dispatchEvent(new CustomEvent('settings-changed', { detail: { key: 'defaultPersonaId' } }))
  window.dispatchEvent(new CustomEvent('personas-changed', { detail: { action: 'reset' } }))
  window.dispatchEvent(new CustomEvent('characters-changed', { detail: { action: 'reset' } }))
  window.dispatchEvent(new CustomEvent('threads-changed', { detail: { action: 'reset' } }))
  window.dispatchEvent(
    new CustomEvent('writingInstructions-changed', { detail: { action: 'reset' } }),
  )
}
