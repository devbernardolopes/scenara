import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import AutoResizeTextarea from './AutoResizeTextarea'
import { X, Save } from '../../lib/icons'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm'

function PromptTextarea({ value, onChange, placeholder, disabled, extraHeight = 8 }) {
  const { t } = useTranslation('common')
  const { openModal } = useModal()
  const hasContent = Boolean(value)
  const hasMeaningfulContent = Boolean(value?.trim())

  function handleSaveToBank() {
    openModal('promptBankForm', {
      initialValues: { name: t('promptBank.newPrompt'), content: value || '' },
    })
  }

  return (
    <div className="relative mt-2">
      <AutoResizeTextarea
        className={`${inputClass} resize-none pr-12 min-h-[128px]`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        extraHeight={extraHeight}
      />
      <div className="absolute top-2 right-2 flex flex-col gap-2 items-end">
        <button
          type="button"
          onClick={() => onChange('')}
          disabled={!hasContent}
          className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md bg-surface text-secondary hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={t('clear')}
          title={t('clear')}
        >
          <X className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleSaveToBank}
          disabled={!hasMeaningfulContent}
          className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md bg-surface text-secondary hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label={t('promptBank.saveToBank')}
          title={t('promptBank.saveToBank')}
        >
          <Save className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default PromptTextarea
