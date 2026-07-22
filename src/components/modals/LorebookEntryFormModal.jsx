import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'
import CollapsibleSection from '../shared/CollapsibleSection'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import Label from '../shared/Label'
import { X } from '../../lib/icons'
import { estimateTokens } from '../../services/tokenEstimator'
import { createEntry, updateEntry } from '../../services/lorebookEntries'
import { POSITION_OPTIONS } from '../../services/lorebookImportExport'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm'

const SECONDARY_LOGIC_OPTIONS = ['none', 'andAny', 'andAll', 'notAny', 'notAll']

function ToggleRow({ label, checked, onChange, disabled = false }) {
  return (
    <label
      className={`flex items-center justify-between gap-3 min-h-[44px] ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <span className="text-sm text-text">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
          checked ? 'bg-primary' : 'bg-gray-300'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}

function TagInput({ label, value, onChange, placeholder, disabled = false }) {
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  function addTag(raw) {
    const trimmed = raw.trim()
    if (!trimmed) return
    if (!value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setText('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(text)
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div>
      <Label>{label}</Label>
      <div
        className={`flex flex-wrap items-center gap-1.5 min-h-[44px] px-2 py-1.5 border border-border rounded-md bg-surface focus-within:ring-2 focus-within:ring-primary ${
          disabled ? 'opacity-50' : ''
        }`}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 pl-2.5 pr-0.5 h-8 rounded-full bg-primary-subtle text-primary text-sm"
          >
            <span className="truncate max-w-[160px]">{tag}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation()
                onChange(value.filter((t) => t !== tag))
              }}
              className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded-full hover:bg-surface-hover"
              aria-label={`Remove ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          disabled={disabled}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(text)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] bg-transparent outline-none text-sm text-text placeholder-tertiary"
        />
      </div>
    </div>
  )
}

function LorebookEntryFormModal({ lorebookId, entry }) {
  const { t } = useTranslation('settings')
  const { closeModal, setCloseGuard } = useModal()
  const { promptSave } = useSaveConfirm()
  const editing = Boolean(entry)

  const initial = useMemo(
    () => ({
      name: entry?.name || '',
      keys: entry?.keys || [],
      secondaryKeys: entry?.secondaryKeys || [],
      secondaryLogic: entry?.secondaryLogic ?? null,
      content: entry?.content || '',
      constant: entry?.constant ?? false,
      enabled: entry?.enabled ?? true,
      position: entry?.position || 'before_char',
      insertionOrder: entry?.insertionOrder ?? 100,
      depth: entry?.depth ?? '',
      probability: entry?.probability ?? null,
      caseSensitive: entry?.caseSensitive ?? false,
      excludeRecursion: entry?.excludeRecursion ?? false,
      characterFilter: entry?.characterFilter ?? null,
    }),
    [],
  )
  const [form, setForm] = useState({ ...initial })
  const [saving, setSaving] = useState(false)
  const savePendingRef = useRef(false)

  const isDirty = Object.keys(initial).some((key) => {
    const a = form[key]
    const b = initial[key]
    if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) !== JSON.stringify(b)
    return a !== b
  })

  const contentTokenCount = useMemo(() => estimateTokens(form.content), [form.content])

  const handleCloseRef = useRef()
  useEffect(() => {
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

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function saveEntry() {
    setSaving(true)
    try {
      const {
        name,
        keys,
        secondaryKeys,
        secondaryLogic,
        content,
        constant,
        enabled,
        position,
        insertionOrder,
        depth,
        probability,
        caseSensitive,
        excludeRecursion,
        characterFilter,
      } = form
      const payload = {
        name: name.trim(),
        keys,
        secondaryKeys,
        secondaryLogic,
        content,
        constant,
        enabled,
        position,
        insertionOrder: Number(insertionOrder) || 0,
        depth: depth === '' || depth == null ? null : Number(depth),
        probability: probability === '' || probability == null ? null : Number(probability),
        caseSensitive,
        excludeRecursion,
        characterFilter,
      }
      if (editing) {
        await updateEntry(entry.id, payload)
      } else {
        await createEntry(lorebookId, payload)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    if (!form.name.trim() || saving) return
    await saveEntry()
    closeModal()
  }

  async function handleCloseAttempt() {
    const result = await promptSave()
    if (result === 'save') {
      await saveEntry()
      closeModal()
    } else if (result === 'discard') {
      closeModal()
    }
  }

  const hasCharacterFilter = Boolean(form.characterFilter)

  return (
    <ModalShell
      title={editing ? t('lorebook.entry.form.editTitle') : t('lorebook.entry.form.title')}
      onClose={isDirty ? handleCloseAttempt : closeModal}
      footer={
        <>
          <button
            type="button"
            onClick={isDirty ? handleCloseAttempt : closeModal}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('lorebook.entry.form.cancel')}
          </button>
          <SaveButton
            isDirty={isDirty}
            saving={saving}
            disabled={!form.name.trim()}
            onClick={handleSave}
            savingText={t('lorebook.entry.form.saving')}
          >
            {t('lorebook.entry.form.save')}
          </SaveButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label required highlight={Boolean(form.name.trim())}>
            {t('lorebook.entry.form.name')}
          </Label>
          <input
            className={inputClass}
            value={form.name}
            onChange={update('name')}
            placeholder={t('lorebook.entry.form.namePlaceholder')}
            required
          />
        </div>

        <TagInput
          label={t('lorebook.entry.form.keys')}
          value={form.keys}
          onChange={(v) => setField('keys', v)}
          placeholder={t('lorebook.entry.form.keysPlaceholder')}
        />

        <CollapsibleSection
          label={t('lorebook.entry.form.content')}
          summary={form.content ? t('common:tokenCount', { count: contentTokenCount }) : null}
          storageKey="lorebookEntryContent"
          defaultExpanded={true}
        >
          <AutoResizeTextarea
            className={`${inputClass} resize-none mt-2`}
            value={form.content}
            onChange={update('content')}
            placeholder={t('lorebook.entry.form.contentPlaceholder')}
            extraHeight={8}
          />
        </CollapsibleSection>

        <ToggleRow
          label={t('lorebook.entry.form.enabled')}
          checked={form.enabled}
          onChange={(v) => setField('enabled', v)}
        />
        <ToggleRow
          label={t('lorebook.entry.form.constant')}
          checked={form.constant}
          onChange={(v) => setField('constant', v)}
        />

        <CollapsibleSection
          label={t('lorebook.entry.form.advanced')}
          storageKey="lorebookEntryAdvanced"
          defaultExpanded={false}
        >
          <div className="pt-2 space-y-4">
            <TagInput
              label={t('lorebook.entry.form.secondaryKeys')}
              value={form.secondaryKeys}
              onChange={(v) => setField('secondaryKeys', v)}
              placeholder={t('lorebook.entry.form.secondaryKeysPlaceholder')}
              disabled={form.secondaryLogic == null}
            />

            <div>
              <Label>{t('lorebook.entry.form.secondaryLogic')}</Label>
              <select
                className={`${inputClass} min-h-[44px]`}
                value={form.secondaryLogic ?? 'none'}
                onChange={(e) =>
                  setField('secondaryLogic', e.target.value === 'none' ? null : e.target.value)
                }
              >
                {SECONDARY_LOGIC_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {t(`lorebook.entry.form.secondaryLogicOptions.${opt}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>{t('lorebook.entry.form.insertionOrder')}</Label>
              <input
                type="number"
                className={inputClass}
                value={form.insertionOrder}
                onChange={update('insertionOrder')}
              />
            </div>

            <div>
              <Label>{t('lorebook.entry.form.position')}</Label>
              <select
                className={`${inputClass} min-h-[44px]`}
                value={form.position}
                onChange={update('position')}
              >
                {POSITION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {t(`lorebook.entry.form.positionOptions.${opt}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label highlight={form.position === 'at_depth'}>
                {t('lorebook.entry.form.depth')}
              </Label>
              <input
                type="number"
                disabled={form.position !== 'at_depth'}
                className={`${inputClass} ${form.position !== 'at_depth' ? 'opacity-50' : ''}`}
                value={form.depth ?? ''}
                onChange={update('depth')}
                placeholder="4"
              />
            </div>

            <div>
              <Label>{t('lorebook.entry.form.probability')}</Label>
              {form.probability == null ? (
                <button
                  type="button"
                  onClick={() => setField('probability', 100)}
                  className="min-h-[44px] px-3 text-sm border border-dashed border-border rounded-md text-secondary hover:bg-surface-hover"
                >
                  {t('lorebook.entry.form.probabilityAlways')}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className={inputClass}
                    value={form.probability}
                    onChange={update('probability')}
                  />
                  <button
                    type="button"
                    onClick={() => setField('probability', null)}
                    className="min-h-[44px] px-3 text-sm border border-border rounded-md text-secondary hover:bg-surface-hover shrink-0"
                  >
                    {t('lorebook.entry.form.probabilityClear')}
                  </button>
                </div>
              )}
            </div>

            <ToggleRow
              label={t('lorebook.entry.form.caseSensitive')}
              checked={form.caseSensitive}
              onChange={(v) => setField('caseSensitive', v)}
            />
            <ToggleRow
              label={t('lorebook.entry.form.excludeRecursion')}
              checked={form.excludeRecursion}
              onChange={(v) => setField('excludeRecursion', v)}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          label={t('lorebook.entry.form.characterFilter')}
          storageKey="lorebookEntryCharacterFilter"
          defaultExpanded={false}
        >
          <div className="pt-2 space-y-4">
            <ToggleRow
              label={t('lorebook.entry.form.characterFilterEnabled')}
              checked={hasCharacterFilter}
              onChange={(v) =>
                setField('characterFilter', v ? { isExclude: false, names: [], tags: [] } : null)
              }
            />
            {hasCharacterFilter && (
              <div className="space-y-3">
                <div>
                  <Label>{t('lorebook.entry.form.characterFilterMode')}</Label>
                  <select
                    className={`${inputClass} min-h-[44px]`}
                    value={form.characterFilter.isExclude ? 'exclude' : 'include'}
                    onChange={(e) =>
                      setField('characterFilter', {
                        ...form.characterFilter,
                        isExclude: e.target.value === 'exclude',
                      })
                    }
                  >
                    <option value="include">
                      {t('lorebook.entry.form.characterFilterInclude')}
                    </option>
                    <option value="exclude">
                      {t('lorebook.entry.form.characterFilterExclude')}
                    </option>
                  </select>
                </div>
                <TagInput
                  label={t('lorebook.entry.form.characterFilterNames')}
                  value={form.characterFilter.names}
                  onChange={(v) =>
                    setField('characterFilter', { ...form.characterFilter, names: v })
                  }
                  placeholder={t('lorebook.entry.form.characterFilterNamesPlaceholder')}
                />
              </div>
            )}
          </div>
        </CollapsibleSection>
      </div>
    </ModalShell>
  )
}

export default LorebookEntryFormModal
