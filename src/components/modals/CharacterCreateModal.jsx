import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import { createCharacter, updateCharacter } from '../../services/characters'
import { getSetting } from '../../services/settings'
import { estimateTokens } from '../../services/tokenEstimator'
import { getWritingInstruction } from '../../services/writingInstructions'
import { getPersona } from '../../services/personas'
import CloseButton from '../shared/CloseButton'
import CharacterSidebar from './character/CharacterSidebar'
import CharacterSection from './character/CharacterSection'
import OverridesSection from './character/OverridesSection'
import PlaceholderSection from './character/PlaceholderSection'
import InitialMessagesSection from './character/InitialMessagesSection'

const INITIAL_FORM = {
  name: '',
  avatar: '',
  tagline: '',
  prompt: '',
  writingInstruction: null,
  extraPrompt: '',
  initialMessages: [],
  autoTitle: true,
  autoTitleThreshold: 3,
  autoTitleSystemInstructions: '',
  autoTitleUserInstructions: '',
  memory: 'messages',
  messagesThreshold: 7,
  contextWindowThreshold: 1024,
  messagesToKeep: 5,
  memorySlots: 3,
  summarizationSystemInstructions: '',
  summarizationUserInstructions: '',
  firstMessage: true,
  userPersonaPrefix: true,
  includeOOC: true,
  postProcessing: true,
  systemAvatarScale: '1x',
  characterAvatarScale: '1x',
  userPersonaAvatarScale: '1x',
  writingInjectionTiming: 'always',
  writingPlacement: 'endOfSystemPrompt',
  writingMessageRole: 'system',
  personaInjectionTiming: 'always',
  personaInjectionPlacement: 'endOfSystemPrompt',
  personaInjectionMessageRole: 'system',
}

const DEFAULTS_MAP = {
  defaultAutoTitle: 'autoTitle',
  defaultAutoTitleThreshold: 'autoTitleThreshold',
  defaultMemory: 'memory',
  defaultMessagesThreshold: 'messagesThreshold',
  defaultContextWindowThreshold: 'contextWindowThreshold',
  defaultMessagesToKeep: 'messagesToKeep',
  defaultMemorySlots: 'memorySlots',
  defaultFirstMessage: 'firstMessage',
  defaultUserPersonaPrefix: 'userPersonaPrefix',
  defaultIncludeOOC: 'includeOOC',
  defaultPostProcessing: 'postProcessing',
  defaultSystemAvatarScale: 'systemAvatarScale',
  defaultCharacterAvatarScale: 'characterAvatarScale',
  defaultUserPersonaAvatarScale: 'userPersonaAvatarScale',
  'prompting.writingInjectionTiming': 'writingInjectionTiming',
  'prompting.writingPlacement': 'writingPlacement',
  'prompting.writingMessageRole': 'writingMessageRole',
  'prompting.personaInjectionTiming': 'personaInjectionTiming',
  personaInjectionPlacement: 'personaInjectionPlacement',
  personaInjectionMessageRole: 'personaInjectionMessageRole',
}

function buildInitialForm(existing) {
  if (!existing) return { ...INITIAL_FORM }
  const result = {}
  for (const key of Object.keys(INITIAL_FORM)) {
    if (key === 'initialMessages' && existing.greeting && !existing.initialMessages) {
      result[key] = [{ id: crypto.randomUUID(), content: existing.greeting }]
    } else if (key in existing) {
      result[key] = existing[key]
    } else if (key === 'tagline' && 'description' in existing) {
      result[key] = existing.description
    } else {
      result[key] = INITIAL_FORM[key]
    }
  }
  return result
}

const SECTION_COMPONENTS = {
  character: CharacterSection,
  overrides: OverridesSection,
  initialMessages: InitialMessagesSection,
  lorebooks: PlaceholderSection,
  tags: PlaceholderSection,
  '3d': PlaceholderSection,
  sfx: PlaceholderSection,
}

function CharacterCreateModal({ character: existing, initialData }) {
  const { t } = useTranslation('characterCreation')
  const { closeModal, setCloseGuard, activeModal } = useModal()
  const { promptSave } = useSaveConfirm()
  const isEditing = Boolean(existing)
  const isImport = Boolean(initialData)
  const characterId = existing?.id || null

  const initialRef = useRef(isImport ? buildInitialForm(initialData) : buildInitialForm(existing))
  const [form, setForm] = useState(initialRef.current)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState('character')
  const savePendingRef = useRef(false)
  const [totalPermTokens, setTotalPermTokens] = useState(0)
  const [defaultPersonaName, setDefaultPersonaName] = useState('')

  useEffect(() => {
    getSetting('defaultPersonaId').then((id) => {
      if (id) getPersona(id).then((p) => setDefaultPersonaName(p?.name || ''))
    })
  }, [])

  useEffect(() => {
    async function compute() {
      const charName = form.name || ''
      const userName = defaultPersonaName || ''
      const replaceVars = (text) =>
        text.replace(/{{char}}/g, charName).replace(/{{user}}/g, userName)

      let total = 0

      if (form.prompt) total += estimateTokens(replaceVars(form.prompt))

      if (form.writingInstruction) {
        const wi = await getWritingInstruction(form.writingInstruction)
        if (wi?.content) total += estimateTokens(replaceVars(wi.content))
      }

      const writingTiming = form.writingInjectionTiming
      if (writingTiming !== 'never') {
        const template = await getSetting('prompting.personaInjectionTemplate')
        if (template && form.personaInjectionTiming !== 'never') {
          total += estimateTokens(replaceVars(template))
        }
      }

      setTotalPermTokens(total)
    }
    compute()
  }, [
    form.prompt,
    form.writingInstruction,
    form.writingInjectionTiming,
    form.personaInjectionTiming,
    form.name,
    defaultPersonaName,
  ])

  useEffect(() => {
    if (isEditing || isImport) return
    const keys = Object.keys(DEFAULTS_MAP)
    Promise.all(keys.map((k) => getSetting(k))).then((values) => {
      const patches = {}
      keys.forEach((key, i) => {
        const val = values[i]
        if (val !== null && val !== undefined) {
          patches[DEFAULTS_MAP[key]] = val
        }
      })
      if (Object.keys(patches).length === 0) return
      const merged = { ...form, ...patches }
      initialRef.current = merged
      setForm(merged)
    })
  }, [isEditing]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = Object.keys(initialRef.current).some(
    (key) => form[key] !== initialRef.current[key],
  )

  const handleCloseRef = useRef()
  handleCloseRef.current = handleCloseAttempt

  useEffect(() => {
    if (isDirty && activeModal === 'characterCreate') {
      setCloseGuard(() => {
        if (savePendingRef.current) return false
        savePendingRef.current = true
        handleCloseRef.current().finally(() => {
          savePendingRef.current = false
        })
        return false
      })
    } else {
      setCloseGuard(null)
    }
    return () => setCloseGuard(null)
  }, [isDirty, setCloseGuard, activeModal])

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function saveCharacter() {
    setSaving(true)
    try {
      const data = {
        ...form,
        initialMessages: (form.initialMessages || []).filter((m) => m.content?.trim()),
      }
      if (isEditing) {
        await updateCharacter(existing.id, data)
      } else {
        await createCharacter(data)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim()) return
    await saveCharacter()
    closeModal()
  }

  async function handleCloseAttempt() {
    const result = await promptSave()
    if (result === 'save') {
      await saveCharacter()
      closeModal()
    } else if (result === 'discard') {
      closeModal()
    }
  }

  const ActivePanel = SECTION_COMPONENTS[activeSection] || PlaceholderSection

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 border-b border-border shrink-0">
        <h2 className="text-xl font-semibold text-text">
          {form.name.trim()
            ? t(isEditing ? 'editTitleFormat' : 'titleFormat', { name: form.name.trim() })
            : t(isEditing ? 'editTitle' : 'title')}
        </h2>
        <CloseButton onClick={isDirty ? handleCloseAttempt : closeModal} />
      </div>

      <div className="px-6 pt-4 pb-2 shrink-0 md:hidden">
        <select
          value={activeSection}
          onChange={(e) => setActiveSection(e.target.value)}
          className="w-full px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface text-text text-sm"
        >
          <option value="character">{t('sectionCharacter')}</option>
          <option value="overrides">{t('sectionOverrides')}</option>
          <option value="initialMessages">{t('sectionInitialMessages')}</option>
          <option value="lorebooks">{t('sectionLorebooks')}</option>
          <option value="tags">{t('sectionTags')}</option>
          <option value="3d">{t('section3d')}</option>
          <option value="sfx">{t('sectionSfx')}</option>
        </select>
      </div>

      <div className="flex flex-1 min-h-0">
        <CharacterSidebar active={activeSection} onSelect={setActiveSection} />
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ActivePanel form={form} onChange={handleChange} characterId={characterId} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border shrink-0">
        <div className="text-xs text-tertiary">
          {t('permanentTokenCount', { count: totalPermTokens })}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={isDirty ? handleCloseAttempt : closeModal}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="min-h-[44px] px-6 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm disabled:opacity-50"
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CharacterCreateModal
