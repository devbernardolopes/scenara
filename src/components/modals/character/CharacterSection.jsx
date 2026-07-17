import { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../../hooks/useModal'
import CollapsibleSection from '../../shared/CollapsibleSection'
import Label from '../../shared/Label'
import AutoResizeTextarea from '../../shared/AutoResizeTextarea'
import { estimateTokens } from '../../../services/tokenEstimator'
import { getAllWritingInstructions } from '../../../services/writingInstructions'
import Avatar from '../../shared/Avatar'
import { FileText, X } from '../../../lib/icons'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

function formatDataSize(byteLen) {
  if (byteLen < 1024) return `${byteLen} B`
  if (byteLen < 1024 * 1024) return `${(byteLen / 1024).toFixed(1)} KB`
  return `${(byteLen / (1024 * 1024)).toFixed(1)} MB`
}

function CharacterSection({ form, onChange, characterId }) {
  const { t } = useTranslation('characterCreation')
  const { openModal } = useModal()
  const fileRef = useRef(null)
  const [writingInstructions, setWritingInstructions] = useState([])

  useEffect(() => {
    getAllWritingInstructions().then(setWritingInstructions)

    const handler = () => getAllWritingInstructions().then(setWritingInstructions)
    window.addEventListener('writingInstructions-changed', handler)
    return () => window.removeEventListener('writingInstructions-changed', handler)
  }, [])

  const hasWritingInstructions = writingInstructions.length > 0
  const selectedWI = form.writingInstruction
    ? writingInstructions.find((wi) => wi.id === form.writingInstruction)
    : null

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result
      if (typeof dataUrl === 'string') {
        onChange('avatar', dataUrl)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label required>{t('nameLabel')}</Label>
        <div className="relative">
          <input
            className={`${inputClass} pr-20`}
            value={form.name}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder={t('namePlaceholder')}
            required
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-tertiary">
            {t('common:tokenCount', { count: estimateTokens(form.name) })}
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-1">{t('avatarLabel')}</label>
        <div className="flex items-center gap-2">
          <Avatar
            src={form.avatar}
            size="2xl"
            className="shrink-0"
            onClick={() => openModal('imageViewer', { src: form.avatar, modalSize: 'fullscreen' })}
          />
          <div className="relative flex-1">
            {form.avatar.startsWith('data:') ? (
              <input
                className={`${inputClass} pr-10`}
                value={t('avatarImageData', { size: formatDataSize(form.avatar.length) })}
                readOnly
              />
            ) : (
              <input
                className={`${inputClass} pr-10`}
                value={form.avatar}
                onChange={(e) => onChange('avatar', e.target.value)}
                placeholder={t('avatarPlaceholder')}
              />
            )}
            {form.avatar && (
              <button
                type="button"
                onClick={() => onChange('avatar', '')}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
                aria-label={t('avatarClear')}
                title={t('avatarClear')}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center border border-border rounded-md text-secondary hover:text-text hover:bg-surface-hover shrink-0"
            aria-label={t('uploadImage', { ns: 'common' })}
            title={t('uploadImage', { ns: 'common' })}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12"
              />
            </svg>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      <CollapsibleSection
        label={t('systemPromptLabel')}
        summary={
          form.systemPrompt
            ? t('common:tokenCount', { count: estimateTokens(form.systemPrompt) })
            : null
        }
        storageKey={characterId ? `charSection.systemPrompt.${characterId}` : undefined}
        defaultExpanded={false}
      >
        <AutoResizeTextarea
          className={`${inputClass} resize-none mt-2`}
          value={form.systemPrompt || ''}
          onChange={(e) => onChange('systemPrompt', e.target.value)}
          placeholder={t('systemPromptPlaceholder')}
          extraHeight={8}
        />
      </CollapsibleSection>

      <CollapsibleSection
        label={t('characterPromptLabel')}
        summary={
          form.prompt ? t('common:tokenCount', { count: estimateTokens(form.prompt) }) : null
        }
        storageKey={characterId ? `charSection.prompt.${characterId}` : undefined}
        defaultExpanded={true}
      >
        <AutoResizeTextarea
          className={`${inputClass} resize-none mt-2`}
          value={form.prompt || ''}
          onChange={(e) => onChange('prompt', e.target.value)}
          placeholder={t('promptPlaceholder')}
          extraHeight={8}
        />
      </CollapsibleSection>

      <CollapsibleSection
        label={t('extraPromptLabel')}
        summary={
          form.extraPrompt
            ? t('common:tokenCount', { count: estimateTokens(form.extraPrompt) })
            : null
        }
        storageKey={characterId ? `charSection.extraPrompt.${characterId}` : undefined}
        defaultExpanded={false}
      >
        <AutoResizeTextarea
          className={`${inputClass} resize-none mt-2`}
          value={form.extraPrompt || ''}
          onChange={(e) => onChange('extraPrompt', e.target.value)}
          placeholder={t('extraPromptPlaceholder')}
          extraHeight={8}
        />
      </CollapsibleSection>

      <CollapsibleSection
        label={t('postHistoryInstructionsLabel')}
        summary={
          form.postHistoryInstructions
            ? t('common:tokenCount', { count: estimateTokens(form.postHistoryInstructions) })
            : null
        }
        storageKey={characterId ? `charSection.postHistoryInstructions.${characterId}` : undefined}
        defaultExpanded={false}
      >
        <AutoResizeTextarea
          className={`${inputClass} resize-none mt-2`}
          value={form.postHistoryInstructions || ''}
          onChange={(e) => onChange('postHistoryInstructions', e.target.value)}
          placeholder={t('postHistoryInstructionsPlaceholder')}
          extraHeight={8}
        />
      </CollapsibleSection>

      <div>
        <label className="block text-sm font-medium text-text mb-1">
          {t('writingInstructionLabel')}
        </label>
        <div className="flex items-center gap-2">
          {hasWritingInstructions ? (
            <>
              <select
                value={form.writingInstruction || ''}
                onChange={(e) =>
                  onChange('writingInstruction', e.target.value ? Number(e.target.value) : null)
                }
                className={`${inputClass} flex-1`}
              >
                <option value="">{t('noneOption')}</option>
                {writingInstructions.map((wi) => (
                  <option key={wi.id} value={wi.id}>
                    {wi.name}
                  </option>
                ))}
              </select>
              {selectedWI && (
                <span className="text-xs text-tertiary whitespace-nowrap">
                  {t('common:tokenCount', { count: estimateTokens(selectedWI.content) })}
                </span>
              )}
            </>
          ) : (
            <select disabled className={`${inputClass} flex-1 opacity-50 cursor-not-allowed`}>
              <option value="">{t('noWritingInstructions')}</option>
            </select>
          )}
          <button
            type="button"
            onClick={() => openModal('writingInstructionManagement')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center border border-border rounded-md text-secondary hover:text-text hover:bg-surface-hover shrink-0"
            aria-label={t('manageWritingInstructions')}
            title={t('manageWritingInstructions')}
          >
            <FileText className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-text mb-1">{t('taglineLabel')}</label>
        <input
          type="text"
          className={inputClass}
          value={form.tagline || ''}
          onChange={(e) => onChange('tagline', e.target.value)}
          placeholder={t('taglinePlaceholder')}
        />
      </div>
    </div>
  )
}

export default CharacterSection
