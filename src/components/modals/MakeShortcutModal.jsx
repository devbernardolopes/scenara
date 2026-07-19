import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import Label from '../shared/Label'
import {
  getAllInChatShortcuts,
  updateInChatShortcut,
  createInChatShortcut,
} from '../../services/inChatShortcuts'
import { Plus } from '../../lib/icons'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

const INSERTION_TYPES = ['Replace', 'Start', 'End', 'Cursor']

const DEFAULTS = {
  name: '',
  message: '',
  insertionType: 'Replace',
  autoSend: false,
  clearAfterSend: true,
}

function buildShortcutDsl({ name, message, insertionType, autoSend, clearAfterSend }) {
  const lines = [`@name=${name}`, `@message=${message}`]
  lines.push(`@insertionType=${insertionType}`)
  lines.push(`@autoSend=${autoSend}`)
  lines.push(`@clearAfterSend=${clearAfterSend}`)
  return lines.join('\n')
}

function countAllShortcuts(sets) {
  let count = 0
  for (const set of sets) {
    if (!set.content) continue
    const blocks = set.content.split(/\n\s*\n/)
    for (const block of blocks) {
      const hasName = block.split('\n').some((l) => /^@name=/.test(l.trim()))
      const hasMessage = block.split('\n').some((l) => /^@message=/.test(l.trim()))
      if (hasName && hasMessage) count++
    }
  }
  return count
}

function MakeShortcutModal({ content = '' }) {
  const { t } = useTranslation('chat')
  const { openModal, closeModal, setCloseGuard } = useModal()
  const { promptSave } = useSaveConfirm()

  const [shortcutSets, setShortcutSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSetId, setSelectedSetId] = useState(null)
  const [form, setForm] = useState({ ...DEFAULTS, message: content })
  const [saving, setSaving] = useState(false)
  const [initialValues, setInitialValues] = useState(null)
  const savePendingRef = useRef(false)

  const isDirty = useMemo(() => {
    if (!initialValues) return false
    return Object.keys(initialValues).some((key) => {
      const val = form[key]
      const init = initialValues[key]
      if (typeof val === 'boolean') return val !== init
      return (val || '') !== (init || '')
    })
  }, [form, initialValues])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const sets = await getAllInChatShortcuts()
        if (cancelled) return
        setShortcutSets(sets)
        if (sets.length > 0) {
          setSelectedSetId(sets[0].id)
          const n = countAllShortcuts(sets) + 1
          const autoName = `SC${n}`
          const initial = {
            name: autoName,
            message: content,
            insertionType: 'Replace',
            autoSend: false,
            clearAfterSend: true,
          }
          setForm((prev) => ({ ...prev, name: autoName }))
          setInitialValues(initial)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [content])

  const handleCloseRef = useRef()

  async function handleSave() {
    if (!form.name.trim() || !form.message.trim() || saving) return
    let setId = selectedSetId
    if (!setId) {
      const id = await createInChatShortcut({ name: 'Shortcuts', content: '', order: 'asc' })
      setSelectedSetId(id)
      const sets = await getAllInChatShortcuts()
      setShortcutSets(sets)
      setId = id
    }
    const selectedSet = shortcutSets.find((s) => s.id === setId)
    const existingContent = selectedSet?.content || ''
    const newBlock = buildShortcutDsl({
      name: form.name.trim(),
      message: form.message.trim(),
      insertionType: form.insertionType,
      autoSend: form.autoSend,
      clearAfterSend: form.clearAfterSend,
    })
    const newContent = existingContent ? `${existingContent.trim()}\n\n${newBlock}` : newBlock
    setSaving(true)
    try {
      await updateInChatShortcut(setId, { content: newContent })
    } finally {
      setSaving(false)
    }
    closeModal()
  }

  async function handleCloseAttempt() {
    const result = await promptSave()
    if (result === 'save') {
      await handleSave()
    } else if (result === 'discard') {
      closeModal()
    }
  }

  useLayoutEffect(() => {
    handleCloseRef.current = handleCloseAttempt
  })

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

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  function toggleField(field) {
    return () => setForm((prev) => ({ ...prev, [field]: !prev[field] }))
  }

  async function handleSetCreated(id) {
    const sets = await getAllInChatShortcuts()
    setShortcutSets(sets)
    if (id) setSelectedSetId(id)
  }

  if (loading) {
    return (
      <ModalShell title={t('makeShortcutModal.title')} onClose={closeModal}>
        <div className="flex items-center justify-center py-12">
          <p className="text-secondary text-sm">{t('loading')}</p>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell
      title={t('makeShortcutModal.title')}
      onClose={isDirty ? handleCloseAttempt : closeModal}
      footer={
        <>
          <button
            type="button"
            onClick={isDirty ? handleCloseAttempt : closeModal}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('makeShortcutModal.cancel')}
          </button>
          <SaveButton
            isDirty={true}
            saving={saving}
            disabled={!form.name.trim() || !form.message.trim()}
            onClick={handleSave}
            savingText={t('makeShortcutModal.saving')}
          >
            {t('makeShortcutModal.save')}
          </SaveButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>{t('makeShortcutModal.shortcutSet')}</Label>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {shortcutSets.map((set) => (
              <button
                key={set.id}
                type="button"
                onClick={() => setSelectedSetId(set.id)}
                className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                  selectedSetId === set.id
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface text-secondary border-border hover:bg-surface-hover'
                }`}
              >
                {set.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => openModal('createShortcutSet', { onCreated: handleSetCreated })}
              aria-label={t('makeShortcutModal.addSet')}
              title={t('makeShortcutModal.addSet')}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-sm font-medium border border-border text-secondary hover:bg-surface-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {shortcutSets.length === 0 && (
            <p className="text-sm text-secondary mt-1">{t('makeShortcutModal.noSets')}</p>
          )}
        </div>

        <div>
          <Label required highlight={Boolean(form.name?.trim())}>
            {t('makeShortcutModal.name')}
          </Label>
          <input className={inputClass} value={form.name} onChange={update('name')} required />
        </div>

        <div>
          <Label required highlight={Boolean(form.message?.trim())}>
            {t('makeShortcutModal.message')}
          </Label>
          <AutoResizeTextarea
            className={`${inputClass} resize-none mt-1`}
            value={form.message}
            onChange={update('message')}
            required
            extraHeight={8}
          />
        </div>

        <div>
          <Label>{t('makeShortcutModal.insertionType')}</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {INSERTION_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, insertionType: type }))}
                className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                  form.insertionType === type
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface text-secondary border-border hover:bg-surface-hover'
                }`}
              >
                {t(`makeShortcutModal.insertion${type}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label>{t('makeShortcutModal.autoSend')}</Label>
          <button
            role="switch"
            aria-checked={form.autoSend}
            onClick={toggleField('autoSend')}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
              form.autoSend ? 'bg-primary' : 'bg-gray-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                form.autoSend ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <Label>{t('makeShortcutModal.clearAfterSend')}</Label>
          <button
            role="switch"
            aria-checked={form.clearAfterSend}
            onClick={toggleField('clearAfterSend')}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
              form.clearAfterSend ? 'bg-primary' : 'bg-gray-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                form.clearAfterSend ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

export default MakeShortcutModal
