import { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../../hooks/useModal'
import { showToast } from '../../../lib/toast'
import CollapsibleSection from '../../shared/CollapsibleSection'
import Label from '../../shared/Label'
import AutoResizeTextarea from '../../shared/AutoResizeTextarea'
import PromptBankButton from '../../shared/PromptBankButton'
import { estimateTokens } from '../../../services/tokenEstimator'
import { getAllWritingInstructions } from '../../../services/writingInstructions'
import {
  getCatboxService,
  catboxUploadAvatar,
  getImgchestService,
  imgchestUploadAvatar,
} from '../../../services/cloudServices'
import { validateUploadSize } from '../../../services/catbox'
import { validateImgchestUploadSize } from '../../../services/imgchest'
import AvatarInput from '../../shared/AvatarInput'
import { FileText, Cloud } from '../../../lib/icons'
import { LIFETIME_OPTIONS, LifetimeButtonGroup } from './ScenarioSection'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm'

function formatDataSize(byteLen) {
  if (byteLen < 1024) return `${byteLen} B`
  if (byteLen < 1024 * 1024) return `${(byteLen / 1024).toFixed(1)} KB`
  return `${(byteLen / (1024 * 1024)).toFixed(1)} MB`
}

function CharacterSection({ form, onChange, characterId }) {
  const { t } = useTranslation('characterCreation')
  const { openModal } = useModal()
  const [writingInstructions, setWritingInstructions] = useState([])
  const [catboxService, setCatboxService] = useState(null)
  const [converting, setConverting] = useState(false)
  const catboxAbortRef = useRef(null)
  const [imgchestService, setImgchestService] = useState(null)
  const [convertingImgchest, setConvertingImgchest] = useState(false)
  const imgchestAbortRef = useRef(null)

  useEffect(() => {
    return () => {
      catboxAbortRef.current?.abort()
      imgchestAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    getAllWritingInstructions().then(setWritingInstructions)

    const handler = () => getAllWritingInstructions().then(setWritingInstructions)
    window.addEventListener('writingInstructions-changed', handler)
    return () => window.removeEventListener('writingInstructions-changed', handler)
  }, [])

  useEffect(() => {
    getCatboxService().then(setCatboxService)
    getImgchestService().then(setImgchestService)
    const handler = () => {
      getCatboxService().then(setCatboxService)
      getImgchestService().then(setImgchestService)
    }
    window.addEventListener('cloudServices-changed', handler)
    return () => window.removeEventListener('cloudServices-changed', handler)
  }, [])

  const hasWritingInstructions = writingInstructions.length > 0
  const selectedWI = form.writingInstruction
    ? writingInstructions.find((wi) => wi.id === form.writingInstruction)
    : null

  async function handleConvertToCatbox() {
    if (!catboxService) {
      showToast(t('catboxNoService'), { type: 'warning' })
      return
    }
    const validation = validateUploadSize(form.avatar)
    if (!validation.ok) {
      const isGif = form.avatar.includes('image/gif')
      showToast(
        t('catboxSizeLimit', { limit: validation.limitMB, type: isGif ? 'GIF' : 'image' }),
        { type: 'error' },
      )
      return
    }
    catboxAbortRef.current?.abort()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)
    catboxAbortRef.current = controller
    setConverting(true)
    try {
      const url = await catboxUploadAvatar(catboxService, form.avatar, {
        signal: controller.signal,
      })
      onChange('avatar', url)
      showToast(t('catboxConvertSuccess'), { type: 'success' })
    } catch (err) {
      if (err.name === 'AbortError') {
        showToast(t('catboxConvertError', { error: 'Timed out' }), { type: 'error' })
      } else {
        showToast(t('catboxConvertError', { error: err.message }), { type: 'error' })
      }
    } finally {
      clearTimeout(timeoutId)
      catboxAbortRef.current = null
      setConverting(false)
    }
  }

  async function handleConvertToImgchest() {
    if (!imgchestService) {
      showToast(t('imgchestNoService'), { type: 'warning' })
      return
    }
    const validation = validateImgchestUploadSize(form.avatar)
    if (!validation.ok) {
      const isGif = form.avatar.includes('image/gif')
      showToast(
        t('imgchestSizeLimit', { limit: validation.limitMB, type: isGif ? 'GIF' : 'image' }),
        { type: 'error' },
      )
      return
    }
    imgchestAbortRef.current?.abort()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)
    imgchestAbortRef.current = controller
    setConvertingImgchest(true)
    try {
      const url = await imgchestUploadAvatar(imgchestService, form.avatar, {
        signal: controller.signal,
      })
      onChange('avatar', url)
      showToast(t('imgchestConvertSuccess'), { type: 'success' })
    } catch (err) {
      if (err.name === 'AbortError') {
        showToast(t('imgchestConvertError', { error: 'Timed out' }), { type: 'error' })
      } else {
        showToast(t('imgchestConvertError', { error: err.message }), { type: 'error' })
      }
    } finally {
      clearTimeout(timeoutId)
      imgchestAbortRef.current = null
      setConvertingImgchest(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label required className={form.name?.trim() ? 'text-highlight' : 'text-text'}>
          {t('nameLabel')}
        </Label>
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
        <Label className={form.displayName?.trim() ? 'text-highlight' : 'text-text'}>
          {t('displayNameLabel')}
        </Label>
        <input
          className={`${inputClass}`}
          value={form.displayName || ''}
          onChange={(e) => onChange('displayName', e.target.value)}
          placeholder={t('displayNamePlaceholder')}
        />
        <p className="text-xs text-tertiary mt-1">{t('displayNameDesc')}</p>
      </div>

      <div>
        <Label className={form.speakerName?.trim() ? 'text-highlight' : 'text-text'}>
          {t('speakerNameLabel')}
        </Label>
        <input
          className={inputClass}
          value={form.speakerName || ''}
          onChange={(e) => onChange('speakerName', e.target.value)}
          placeholder={t('speakerNamePlaceholder')}
        />
        <p className="text-xs text-tertiary mt-1">{t('speakerNameDesc')}</p>
      </div>

      <div>
        <label
          className={`block text-sm font-medium mb-1 ${form.avatar?.trim() ? 'text-highlight' : 'text-text'}`}
        >
          {t('avatarLabel')}
        </label>
        <AvatarInput
          value={form.avatar}
          onChange={(v) => onChange('avatar', v)}
          inputId="character-avatar"
          placeholder={t('avatarPlaceholder')}
          imageDataLabel={t('avatarImageData', { size: formatDataSize(form.avatar.length) })}
          clearLabel={t('avatarClear')}
          uploadLabel={t('uploadImage', { ns: 'common' })}
          errorText={t('common:avatar.invalid')}
          onZoom={() => openModal('imageViewer', { src: form.avatar, modalSize: 'fullscreen' })}
        />
        {form.avatar.startsWith('data:') && catboxService && (
          <button
            type="button"
            onClick={handleConvertToCatbox}
            disabled={converting}
            className="flex items-center gap-1.5 mt-1.5 text-xs text-accent hover:underline disabled:opacity-50"
          >
            <Cloud className="w-3 h-3" />
            {converting ? t('convertingToCatbox') : t('convertToCatbox')}
          </button>
        )}
        {form.avatar.startsWith('data:') && imgchestService && (
          <button
            type="button"
            onClick={handleConvertToImgchest}
            disabled={convertingImgchest}
            className="flex items-center gap-1.5 mt-1.5 text-xs text-accent hover:underline disabled:opacity-50"
          >
            <Cloud className="w-3 h-3" />
            {convertingImgchest ? t('convertingToImgchest') : t('convertToImgchest')}
          </button>
        )}
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
        headerExtra={<PromptBankButton onSelect={(content) => onChange('systemPrompt', content)} />}
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
        headerExtra={<PromptBankButton onSelect={(content) => onChange('prompt', content)} />}
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
        label={t('personalityLabel')}
        summary={
          form.personality
            ? t('common:tokenCount', { count: estimateTokens(form.personality) })
            : null
        }
        storageKey={characterId ? `charSection.personality.${characterId}` : undefined}
        defaultExpanded={false}
        headerExtra={<PromptBankButton onSelect={(content) => onChange('personality', content)} />}
      >
        <AutoResizeTextarea
          className={`${inputClass} resize-none mt-2`}
          value={form.personality || ''}
          onChange={(e) => onChange('personality', e.target.value)}
          placeholder={t('personalityPlaceholder')}
          extraHeight={8}
        />
      </CollapsibleSection>

      <CollapsibleSection
        label={t('statusBlockLabel')}
        summary={
          form.statusBlock
            ? t('common:tokenCount', { count: estimateTokens(form.statusBlock) })
            : null
        }
        storageKey={characterId ? `charSection.statusBlock.${characterId}` : undefined}
        defaultExpanded={false}
        headerExtra={<PromptBankButton onSelect={(content) => onChange('statusBlock', content)} />}
      >
        <AutoResizeTextarea
          className={`${inputClass} resize-none mt-2`}
          value={form.statusBlock || ''}
          onChange={(e) => onChange('statusBlock', e.target.value)}
          placeholder={t('statusBlockPlaceholder')}
          extraHeight={8}
        />
      </CollapsibleSection>

      <CollapsibleSection
        label={t('globalContextLabel')}
        summary={
          form.globalContext
            ? t('common:tokenCount', { count: estimateTokens(form.globalContext) })
            : null
        }
        storageKey={characterId ? `charSection.globalContext.${characterId}` : undefined}
        defaultExpanded={false}
        headerExtra={
          <PromptBankButton onSelect={(content) => onChange('globalContext', content)} />
        }
      >
        <AutoResizeTextarea
          className={`${inputClass} resize-none mt-2`}
          value={form.globalContext || ''}
          onChange={(e) => onChange('globalContext', e.target.value)}
          placeholder={t('globalContextPlaceholder')}
          extraHeight={8}
        />
      </CollapsibleSection>

      <div className="flex items-center gap-3 px-3">
        <label className="text-sm text-text shrink-0">{t('scenarioLifetime')}</label>
        <LifetimeButtonGroup
          options={LIFETIME_OPTIONS}
          value={form.globalContextLifetime || 'always'}
          onChange={(value) => onChange('globalContextLifetime', value)}
          disabled={!form.globalContext?.trim()}
        />
      </div>

      <CollapsibleSection
        label={t('extraPromptLabel')}
        summary={
          form.extraPrompt
            ? t('common:tokenCount', { count: estimateTokens(form.extraPrompt) })
            : null
        }
        storageKey={characterId ? `charSection.extraPrompt.${characterId}` : undefined}
        defaultExpanded={false}
        headerExtra={<PromptBankButton onSelect={(content) => onChange('extraPrompt', content)} />}
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
        headerExtra={
          <PromptBankButton onSelect={(content) => onChange('postHistoryInstructions', content)} />
        }
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
        <label
          className={`block text-sm font-medium mb-1 ${form.writingInstruction ? 'text-highlight' : 'text-text'}`}
        >
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
        <label
          className={`block text-sm font-medium mb-1 ${form.tagline?.trim() ? 'text-highlight' : 'text-text'}`}
        >
          {t('taglineLabel')}
        </label>
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
