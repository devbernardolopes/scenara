import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'
import CollapsibleSection from '../shared/CollapsibleSection'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import Label from '../shared/Label'
import { Plus } from '../../lib/icons'
import {
  createPromptBankEntry,
  updatePromptBankEntry,
  getBuiltInKinds,
  getAllKinds,
} from '../../services/promptBank'
import { estimateTokens } from '../../services/tokenEstimator'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

function PromptBankFormModal({ promptBankEntry }) {
  const { t } = useTranslation('settings')
  const { openModal, closeModal, setCloseGuard } = useModal()
  const { promptSave } = useSaveConfirm()
  const editing = Boolean(promptBankEntry)

  const initialRef = useRef({
    name: promptBankEntry?.name || '',
    kind: promptBankEntry?.kind || '',
    content: promptBankEntry?.content || '',
  })

  const [form, setForm] = useState({ ...initialRef.current })
  const [saving, setSaving] = useState(false)
  const savePendingRef = useRef(false)
  const [allKinds, setAllKinds] = useState([])

  const isDirty = Object.keys(initialRef.current).some(
    (key) => form[key] !== initialRef.current[key],
  )

  const handleCloseRef = useRef()
  handleCloseRef.current = handleCloseAttempt

  useEffect(() => {
    loadKinds()
  }, [])

  useEffect(() => {
    function handleKindsChanged() {
      loadKinds()
    }
    window.addEventListener('promptBank-changed', handleKindsChanged)
    return () => window.removeEventListener('promptBank-changed', handleKindsChanged)
  }, [])

  async function loadKinds() {
    const kinds = await getAllKinds()
    setAllKinds(kinds)
  }

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

  function setKind(kind) {
    setForm((prev) => ({ ...prev, kind }))
  }

  async function saveEntry() {
    setSaving(true)
    try {
      if (editing) {
        await updatePromptBankEntry(promptBankEntry.id, {
          name: form.name.trim(),
          kind: form.kind,
          content: form.content,
        })
      } else {
        await createPromptBankEntry({
          name: form.name.trim(),
          kind: form.kind,
          content: form.content,
        })
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

  function handleKindCreated(kindName) {
    setKind(kindName)
    setAllKinds((prev) => (prev.includes(kindName) ? prev : [...prev, kindName]))
  }

  const builtInKinds = getBuiltInKinds()
  const userKinds = allKinds.filter((k) => !builtInKinds.includes(k))

  return (
    <ModalShell
      title={editing ? t('promptBank.form.editTitle') : t('promptBank.form.title')}
      onClose={isDirty ? handleCloseAttempt : closeModal}
      footer={
        <>
          <button
            type="button"
            onClick={isDirty ? handleCloseAttempt : closeModal}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('promptBank.form.cancel')}
          </button>
          <SaveButton
            isDirty={isDirty}
            saving={saving}
            disabled={!form.name.trim()}
            onClick={handleSave}
            savingText={t('promptBank.form.saving')}
          >
            {t('promptBank.form.save')}
          </SaveButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label required highlight={Boolean(form.name.trim())}>
            {t('promptBank.form.nameLabel')}
          </Label>
          <input
            className={inputClass}
            value={form.name}
            onChange={update('name')}
            placeholder={t('promptBank.form.namePlaceholder')}
            required
          />
        </div>

        <div>
          <Label>{t('promptBank.form.kindLabel')}</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {builtInKinds.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setKind(form.kind === kind ? '' : kind)}
                className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                  form.kind === kind
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface text-secondary border-border hover:bg-surface-hover'
                }`}
              >
                {kind}
              </button>
            ))}
          </div>
          {userKinds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {userKinds.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setKind(form.kind === kind ? '' : kind)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-medium border transition-colors flex items-center gap-1 ${
                    form.kind === kind
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface text-secondary border-border hover:bg-surface-hover'
                  }`}
                >
                  {kind}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => openModal('promptBankKind', { onCreated: handleKindCreated })}
            className="min-h-[36px] mt-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border border-dashed text-secondary hover:bg-surface-hover transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            {t('promptBank.form.addKind')}
          </button>
        </div>

        <CollapsibleSection
          label={t('promptBank.form.contentLabel')}
          summary={
            form.content ? t('common:tokenCount', { count: estimateTokens(form.content) }) : null
          }
          storageKey="promptBankContent"
          defaultExpanded={true}
        >
          <AutoResizeTextarea
            className={`${inputClass} resize-none mt-2`}
            value={form.content}
            onChange={update('content')}
            placeholder={t('promptBank.form.contentPlaceholder')}
            extraHeight={8}
          />
        </CollapsibleSection>
      </div>
    </ModalShell>
  )
}

export default PromptBankFormModal
