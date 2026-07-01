import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import { createCharacter, updateCharacter } from '../../services/characters'
import CloseButton from '../shared/CloseButton'
import CharacterSidebar from './character/CharacterSidebar'
import CharacterSection from './character/CharacterSection'
import OverridesSection from './character/OverridesSection'
import PlaceholderSection from './character/PlaceholderSection'

const INITIAL_FORM = {
  name: '',
  avatar: '',
  description: '',
  personality: '',
  greeting: '',
  scenario: '',
  sampleChat: '',
  autoTitle: false,
  autoTitleThreshold: 256,
  autoTitleSystemInstructions: '',
  autoTitleUserInstructions: '',
  memory: false,
  memoryThreshold: 1024,
  summarizationSystemInstructions: '',
  summarizationUserInstructions: '',
  firstMessage: false,
  userPersonaPrefix: false,
  includeOOC: false,
  postProcessing: false,
  characterAvatarScale: '2x',
  userPersonaAvatarScale: '2x',
}

function buildInitialForm(existing) {
  if (!existing) return { ...INITIAL_FORM }
  const result = {}
  for (const key of Object.keys(INITIAL_FORM)) {
    result[key] = key in existing ? existing[key] : INITIAL_FORM[key]
  }
  return result
}

const SECTION_COMPONENTS = {
  character: CharacterSection,
  overrides: OverridesSection,
  '3d': PlaceholderSection,
  sfx: PlaceholderSection,
  tags: PlaceholderSection,
  lorebooks: PlaceholderSection,
}

function CharacterCreateModal({ character: existing }) {
  const { t } = useTranslation('characterCreation')
  const { closeModal, setCloseGuard } = useModal()
  const { promptSave } = useSaveConfirm()
  const isEditing = Boolean(existing)
  const characterId = existing?.id || null

  const initialRef = useRef(buildInitialForm(existing))
  const [form, setForm] = useState(initialRef.current)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState('character')
  const savePendingRef = useRef(false)

  const isDirty = Object.keys(initialRef.current).some(
    (key) => form[key] !== initialRef.current[key],
  )

  const handleCloseRef = useRef()
  handleCloseRef.current = handleCloseAttempt

  useEffect(() => {
    if (isDirty) {
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
  }, [isDirty, setCloseGuard])

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function saveCharacter() {
    setSaving(true)
    try {
      if (isEditing) {
        await updateCharacter(existing.id, form)
      } else {
        await createCharacter(form)
      }
      window.dispatchEvent(new CustomEvent('characters-changed'))
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
          {isEditing ? t('editTitle') : t('title')}
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
          <option value="3d">{t('section3d')}</option>
          <option value="sfx">{t('sectionSfx')}</option>
          <option value="tags">{t('sectionTags')}</option>
          <option value="lorebooks">{t('sectionLorebooks')}</option>
        </select>
      </div>

      <div className="flex flex-1 min-h-0">
        <CharacterSidebar active={activeSection} onSelect={setActiveSection} />
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <ActivePanel form={form} onChange={handleChange} characterId={characterId} />
        </div>
      </div>

      <div className="flex justify-end gap-3 px-6 py-4 border-t border-border shrink-0">
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
  )
}

export default CharacterCreateModal
