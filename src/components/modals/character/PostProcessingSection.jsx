import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getPostProcessingRules } from '../../../services/settings'
import PostProcessingRuleEditor from '../../shared/PostProcessingRuleEditor'

function ToggleRow({ label, checked, onChange, disabled }) {
  return (
    <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
      <span className="text-sm text-text">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
          checked ? 'bg-primary' : 'bg-gray-300'
        } ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
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

function PostProcessingSection({ form, onChange }) {
  const { t } = useTranslation('characterCreation')
  const [globalRules, setGlobalRules] = useState([])

  useEffect(() => {
    getPostProcessingRules().then(setGlobalRules)
  }, [])

  function handleOverrideChange(value) {
    onChange('postProcessingOverride', value)
    if (value && (!form.postProcessingRules || form.postProcessingRules.length === 0)) {
      onChange(
        'postProcessingRules',
        globalRules.map((r) => ({ ...r })),
      )
    }
  }

  return (
    <div className="space-y-5">
      <ToggleRow
        label={t('postProcessingEnable')}
        checked={form.postProcessing}
        onChange={(v) => onChange('postProcessing', v)}
      />

      <ToggleRow
        label={t('postProcessingOverride')}
        checked={form.postProcessingOverride}
        onChange={handleOverrideChange}
        disabled={!form.postProcessing}
      />

      {form.postProcessing && form.postProcessingOverride && (
        <div className="ml-7 border-l border-border pl-4 space-y-4">
          <PostProcessingRuleEditor
            rules={form.postProcessingRules || []}
            onChange={(rules) => onChange('postProcessingRules', rules)}
          />
        </div>
      )}
    </div>
  )
}

export default PostProcessingSection
