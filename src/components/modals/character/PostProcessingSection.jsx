import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getSetting, getPostProcessingRules } from '../../../services/settings'
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

function PostProcessingSection({ form, onChange, onDiffChange }) {
  const { t } = useTranslation('characterCreation')
  const [globalRules, setGlobalRules] = useState([])
  const [globalEnabled, setGlobalEnabled] = useState(true)

  useEffect(() => {
    Promise.all([getPostProcessingRules(), getSetting('defaultPostProcessing')]).then(
      ([rules, enabled]) => {
        setGlobalRules(rules)
        setGlobalEnabled(enabled !== false)
      },
    )
  }, [])

  useEffect(() => {
    if (!onDiffChange) return
    const enabledDiff = form.postProcessing !== globalEnabled
    const overrideDiff = form.postProcessingOverride === true
    const rulesDiff =
      form.postProcessingOverride && rulesDiffer(form.postProcessingRules || [], globalRules)
    onDiffChange(enabledDiff || overrideDiff || rulesDiff)
  }, [
    form.postProcessing,
    form.postProcessingOverride,
    form.postProcessingRules,
    globalRules,
    globalEnabled,
    onDiffChange,
  ])

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
            resetToRules={globalRules}
          />
        </div>
      )}
    </div>
  )
}

export default PostProcessingSection
