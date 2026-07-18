import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import { createCharacter, updateCharacter } from '../../services/characters'
import { getSetting, getPostProcessingRules } from '../../services/settings'
import { getAllTags, createTag } from '../../services/tags'
import { estimateTokens } from '../../services/tokenEstimator'
import { getWritingInstruction } from '../../services/writingInstructions'
import { getPersona } from '../../services/personas'
import CloseButton from '../shared/CloseButton'
import SaveButton from '../shared/SaveButton'
import CharacterSidebar from './character/CharacterSidebar'
import CharacterSection from './character/CharacterSection'
import OverridesSection from './character/OverridesSection'
import PostProcessingSection from './character/PostProcessingSection'
import PlaceholderSection from './character/PlaceholderSection'
import InitialMessagesSection from './character/InitialMessagesSection'
import ExampleMessagesSection from './character/ExampleMessagesSection'
import DirectorSection from './character/DirectorSection'
import TagsSection from './character/TagsSection'
import ScenarioSection from './character/ScenarioSection'

const INITIAL_FORM = {
  name: '',
  displayName: '',
  avatar: '',
  tagline: '',
  prompt: '',
  personality: '',
  globalContext: '',
  globalContextLifetime: 'always',
  systemPrompt: '',
  writingInstruction: null,
  extraPrompt: '',
  postHistoryInstructions: '',
  initialMessages: [],
  exampleMessages: [],
  scenarios: [],
  promptUser: true,
  autoTitle: true,
  autoTitleThreshold: 1,
  autoTitleSystemInstructions: '',
  autoTitleUserInstructions: '',
  memory: 'messages',
  messagesThreshold: 7,
  contextWindowThreshold: 1024,
  messagesToKeep: 5,
  memorySlots: 3,
  addCharacterPrompt: false,
  summarizationSystemInstructions: '',
  summarizationUserInstructions: '',
  directorEnabled: false,
  directorAutoTitleEnabled: false,
  directorAutoTitleInstructions: '',
  directorSummarizationEnabled: false,
  directorSummarizationInstructions: '',
  directorRegularChatEnabled: false,
  directorRegularChatSystemInstructions: '',
  directorRegularChatInstructions: '',
  directorRegularChatOutputDirectorResponse: true,
  directorOOCEnabled: false,
  directorOOCInstructions: '',
  firstMessage: true,
  userPersonaPrefix: true,
  includeOOC: true,
  removeMarkdownImages: true,
  postProcessing: true,
  postProcessingOverride: false,
  postProcessingRules: [],
  systemAvatarScale: '1x',
  characterAvatarScale: '1x',
  userPersonaAvatarScale: '1x',
  writingInjectionTiming: 'always',
  writingPlacement: 'endOfSystemPrompt',
  writingMessageRole: 'system',
  personaInjectionTiming: 'always',
  personaInjectionPlacement: 'endOfSystemPrompt',
  personaInjectionMessageRole: 'system',
  tags: [],
  lastSection: null,
}

const DEFAULTS_MAP = {
  defaultAutoTitle: 'autoTitle',
  defaultAutoTitleThreshold: 'autoTitleThreshold',
  defaultMemory: 'memory',
  defaultMessagesThreshold: 'messagesThreshold',
  defaultContextWindowThreshold: 'contextWindowThreshold',
  defaultMessagesToKeep: 'messagesToKeep',
  defaultMemorySlots: 'memorySlots',
  defaultAddCharacterPrompt: 'addCharacterPrompt',
  defaultFirstMessage: 'firstMessage',
  defaultUserPersonaPrefix: 'userPersonaPrefix',
  defaultIncludeOOC: 'includeOOC',
  defaultRemoveMarkdownImages: 'removeMarkdownImages',
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

const OVERRIDE_FIELDS = [
  'autoTitle',
  'autoTitleThreshold',
  'autoTitleSystemInstructions',
  'autoTitleUserInstructions',
  'memory',
  'messagesThreshold',
  'contextWindowThreshold',
  'messagesToKeep',
  'memorySlots',
  'addCharacterPrompt',
  'summarizationSystemInstructions',
  'summarizationUserInstructions',
  'firstMessage',
  'userPersonaPrefix',
  'includeOOC',
  'removeMarkdownImages',
  'postProcessing',
  'systemAvatarScale',
  'characterAvatarScale',
  'userPersonaAvatarScale',
  'writingInjectionTiming',
  'writingPlacement',
  'writingMessageRole',
  'personaInjectionTiming',
  'personaInjectionPlacement',
  'personaInjectionMessageRole',
]

const DIRECTOR_GROUP_FIELDS = [
  { enabledKey: 'directorAutoTitleEnabled', instructionsKey: 'directorAutoTitleInstructions' },
  {
    enabledKey: 'directorSummarizationEnabled',
    instructionsKey: 'directorSummarizationInstructions',
  },
  {
    enabledKey: 'directorRegularChatEnabled',
    instructionsKey: 'directorRegularChatSystemInstructions',
  },
  { enabledKey: 'directorRegularChatEnabled', instructionsKey: 'directorRegularChatInstructions' },
  { enabledKey: 'directorOOCEnabled', instructionsKey: 'directorOOCInstructions' },
]

function rulesDiffer(a, b) {
  if (a.length !== b.length) return true
  for (let i = 0; i < a.length; i++) {
    const ra = a[i]
    const rb = b[i]
    if (
      ra.label !== rb.label ||
      ra.color !== rb.color ||
      ra.fontSizePercent !== rb.fontSizePercent ||
      JSON.stringify(ra.openChars) !== JSON.stringify(rb.openChars) ||
      JSON.stringify(ra.closeChars) !== JSON.stringify(rb.closeChars)
    )
      return true
  }
  return false
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
  postProcessing: PostProcessingSection,
  initialMessages: InitialMessagesSection,
  exampleMessages: ExampleMessagesSection,
  scenarios: ScenarioSection,
  director: DirectorSection,
  lorebooks: PlaceholderSection,
  tags: TagsSection,
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
  const [activeSection, setActiveSection] = useState(form.lastSection || 'character')
  const savePendingRef = useRef(false)
  const [totalPermTokens, setTotalPermTokens] = useState(0)
  const [defaultPersonaName, setDefaultPersonaName] = useState('')
  const [defaultPersonaDescription, setDefaultPersonaDescription] = useState('')
  const [overrideDefaults, setOverrideDefaults] = useState(null)
  const [wiRevision, setWiRevision] = useState(0)
  const [ppGlobals, setPpGlobals] = useState({ rules: [], enabled: true })

  useEffect(() => {
    getSetting('defaultPersonaId').then((id) => {
      if (id)
        getPersona(id).then((p) => {
          setDefaultPersonaName(p?.name || '')
          setDefaultPersonaDescription(p?.description || '')
        })
    })
  }, [])

  useEffect(() => {
    const keys = Object.keys(DEFAULTS_MAP)
    Promise.all(keys.map((k) => getSetting(k))).then((values) => {
      const defaults = {}
      keys.forEach((key, i) => {
        const val = values[i]
        if (val !== null && val !== undefined) {
          defaults[DEFAULTS_MAP[key]] = val
        }
      })
      setOverrideDefaults(defaults)
    })
  }, [])

  useEffect(() => {
    const handler = () => setWiRevision((c) => c + 1)
    window.addEventListener('writingInstructions-changed', handler)
    return () => window.removeEventListener('writingInstructions-changed', handler)
  }, [])

  useEffect(() => {
    Promise.all([getPostProcessingRules(), getSetting('defaultPostProcessing')]).then(
      ([rules, enabled]) => {
        setPpGlobals({ rules, enabled: enabled !== false })
      },
    )
  }, [])

  useEffect(() => {
    async function compute() {
      const charName = form.name || ''
      const userName = defaultPersonaName || ''
      const replaceVars = (text) =>
        text
          .replace(/{{char}}/gi, charName)
          .replace(/{{user}}/gi, userName)
          .replace(/{{description}}/gi, defaultPersonaDescription)
          .replace(/{{description_chat}}/gi, defaultPersonaDescription)
          .replace(/{{description_default}}/gi, defaultPersonaDescription)

      let total = 0

      if (form.prompt) total += estimateTokens(replaceVars(form.prompt))

      if (form.personality) total += estimateTokens(replaceVars(form.personality))

      if (form.globalContext) total += estimateTokens(replaceVars(form.globalContext))

      if (form.systemPrompt) total += estimateTokens(replaceVars(form.systemPrompt))

      if (form.postHistoryInstructions)
        total += estimateTokens(replaceVars(form.postHistoryInstructions))

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
    form.personality,
    form.globalContext,
    form.systemPrompt,
    form.postHistoryInstructions,
    form.writingInstruction,
    form.writingInjectionTiming,
    form.personaInjectionTiming,
    form.name,
    defaultPersonaName,
    defaultPersonaDescription,
    wiRevision,
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

  useEffect(() => {
    if (!isImport) return
    const tags = form.tags
    if (!tags?.length || typeof tags[0] !== 'string') return
    getAllTags().then(async (existing) => {
      const nameToId = new Map(existing.map((t) => [t.name.toLowerCase(), t.id]))
      const resolved = []
      for (const name of tags) {
        const id = nameToId.get(name.toLowerCase())
        if (id) {
          resolved.push(id)
        } else {
          const newId = await createTag(name)
          resolved.push(newId)
        }
      }
      setForm((prev) => ({ ...prev, tags: resolved }))
    })
  }, [isImport]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty =
    isImport ||
    Object.keys(initialRef.current).some((key) => {
      const val = form[key]
      const init = initialRef.current[key]
      if (Array.isArray(val)) return JSON.stringify(val) !== JSON.stringify(init)
      return val !== init
    })

  const sectionHighlights = useMemo(() => {
    const ppEnabledDiff = form.postProcessing !== ppGlobals.enabled
    const ppOverrideDiff = form.postProcessingOverride === true
    const ppRulesDiff =
      form.postProcessingOverride && rulesDiffer(form.postProcessingRules || [], ppGlobals.rules)
    const highlights = {
      character:
        form.name?.trim() ||
        form.avatar?.trim() ||
        form.writingInstruction ||
        form.prompt?.trim() ||
        form.personality?.trim() ||
        form.globalContext?.trim() ||
        form.extraPrompt?.trim() ||
        form.postHistoryInstructions?.trim() ||
        form.tagline?.trim(),
      initialMessages: (form.initialMessages || []).some((m) => m.content?.trim()),
      exampleMessages: (form.exampleMessages || []).some((m) => m.content?.trim()),
      tags: (form.tags || []).length > 0,
      scenarios: (form.scenarios || []).some((s) => s?.active),
      postProcessing: ppEnabledDiff || ppOverrideDiff || ppRulesDiff,
      overrides: false,
      director:
        form.directorEnabled &&
        DIRECTOR_GROUP_FIELDS.some((g) => form[g.enabledKey] && form[g.instructionsKey]?.trim()),
    }
    if (overrideDefaults) {
      highlights.overrides = OVERRIDE_FIELDS.some((key) => {
        const defaultVal = key in overrideDefaults ? overrideDefaults[key] : INITIAL_FORM[key]
        const currentVal = form[key]
        if (Array.isArray(currentVal)) {
          return JSON.stringify(currentVal) !== JSON.stringify(defaultVal)
        }
        return currentVal !== defaultVal
      })
    }
    return highlights
  }, [form, overrideDefaults, ppGlobals])

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

  function handleSectionChange(section) {
    setActiveSection(section)
    handleChange('lastSection', section)
    if (characterId && section !== existing?.lastSection) {
      updateCharacter(characterId, { lastSection: section })
    }
  }

  async function saveCharacter() {
    setSaving(true)
    try {
      const data = {
        ...form,
        initialMessages: (form.initialMessages || []).filter((m) => m.content?.trim()),
        exampleMessages: (form.exampleMessages || []).filter((m) => m.content?.trim()),
        scenarios: (form.scenarios || []).filter((s) => s.content?.trim()),
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
    const canSave = Boolean(form.name.trim())
    const result = await promptSave({
      saveDisabled: !canSave,
      message: !canSave
        ? t('common:saveDialog.nameRequired')
        : isImport
          ? t('common:saveDialog.importMessage')
          : undefined,
    })
    if (result === 'save') {
      if (!form.name.trim()) return
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
          onChange={(e) => handleSectionChange(e.target.value)}
          className="w-full px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface text-text text-sm"
        >
          {[
            { id: 'character', labelKey: 'sectionCharacter' },
            { id: 'overrides', labelKey: 'sectionOverrides' },
            { id: 'postProcessing', labelKey: 'sectionPostProcessing' },
            { id: 'initialMessages', labelKey: 'sectionInitialMessages' },
            { id: 'exampleMessages', labelKey: 'sectionExampleMessages' },
            { id: 'scenarios', labelKey: 'sectionScenarios' },
            { id: 'director', labelKey: 'sectionDirector' },
            { id: 'lorebooks', labelKey: 'sectionLorebooks' },
            { id: 'tags', labelKey: 'sectionTags' },
            { id: '3d', labelKey: 'section3d' },
            { id: 'sfx', labelKey: 'sectionSfx' },
          ].map((sec) => (
            <option key={sec.id} value={sec.id}>
              {sectionHighlights[sec.id] ? `● ${t(sec.labelKey)}` : t(sec.labelKey)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 min-h-0">
        <CharacterSidebar
          active={activeSection}
          onSelect={handleSectionChange}
          highlights={sectionHighlights}
        />
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
          <SaveButton
            isDirty={isDirty}
            saving={saving}
            disabled={!form.name.trim()}
            onClick={handleSave}
            savingText={t('saving')}
          >
            {t('save')}
          </SaveButton>
        </div>
      </div>
    </div>
  )
}

export default CharacterCreateModal
