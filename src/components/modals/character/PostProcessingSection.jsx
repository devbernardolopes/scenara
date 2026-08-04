import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getSetting, getPostProcessingRules } from '../../../services/settings'
import PostProcessingRuleEditor from '../../shared/PostProcessingRuleEditor'
import { useConfirm } from '../../../lib/confirm'
import { RefreshCw } from '../../../lib/icons'

function ToggleRow({ label, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-[44px]">
      <span className="text-sm text-text">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
          checked ? 'toggle-track-on' : 'toggle-track-off'
        } ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full toggle-knob transform transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
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
      ra.effect !== rb.effect ||
      JSON.stringify(ra.openChars) !== JSON.stringify(rb.openChars) ||
      JSON.stringify(ra.closeChars) !== JSON.stringify(rb.closeChars)
    )
      return true
  }
  return false
}

function PostProcessingSection({ form, onChange, onDiffChange }) {
  const { t } = useTranslation('characterCreation')
  const { confirm } = useConfirm()
  const [globalRules, setGlobalRules] = useState([])
  const [globalEnabled, setGlobalEnabled] = useState(true)
  const [globalInjectQuotes, setGlobalInjectQuotes] = useState(true)

  useEffect(() => {
    Promise.all([
      getPostProcessingRules(),
      getSetting('defaultPostProcessing'),
      getSetting('defaultInjectQuotes'),
    ]).then(([rules, enabled, injectQuotes]) => {
      setGlobalRules(rules)
      setGlobalEnabled(enabled !== false)
      setGlobalInjectQuotes(injectQuotes !== false)
    })
  }, [])

  useEffect(() => {
    if (!onDiffChange) return
    const enabledDiff = form.postProcessing !== globalEnabled
    const overrideDiff = form.postProcessingOverride === true
    const rulesDiff =
      form.postProcessingOverride && rulesDiffer(form.postProcessingRules || [], globalRules)
    const injectDiff =
      form.postProcessing && form.postProcessingOverride && form.injectQuotes !== globalInjectQuotes
    onDiffChange(enabledDiff || overrideDiff || rulesDiff || injectDiff)
  }, [
    form.postProcessing,
    form.postProcessingOverride,
    form.postProcessingRules,
    form.injectQuotes,
    globalRules,
    globalEnabled,
    globalInjectQuotes,
    onDiffChange,
  ])

  function handleOverrideChange(value) {
    onChange('postProcessingOverride', value)
    if (value) {
      if (!form.postProcessingRules || form.postProcessingRules.length === 0) {
        onChange(
          'postProcessingRules',
          globalRules.map((r) => ({ ...r })),
        )
      }
      onChange('injectQuotes', globalInjectQuotes)
    }
  }

  async function handleReset() {
    const ok = await confirm({
      title: t('resetConfirmTitle'),
      message: t('resetConfirmMessage'),
      confirmLabel: t('reset'),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (!ok) return
    onChange('postProcessing', globalEnabled)
    onChange('postProcessingOverride', false)
    onChange('injectQuotes', globalInjectQuotes)
    onChange('postProcessingRules', [])
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="min-h-[44px] px-4 py-2 rounded-md text-sm font-medium border border-border bg-surface text-secondary hover:bg-surface-hover inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t('reset')}
        </button>
      </div>
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
        <div className="space-y-4">
          <ToggleRow
            label={t('settings:postProcessing.injectQuotes.label')}
            checked={form.injectQuotes !== false}
            onChange={(v) => onChange('injectQuotes', v)}
          />
          <PostProcessingRuleEditor
            rules={form.postProcessingRules || []}
            onChange={(rules) => onChange('postProcessingRules', rules)}
            resetToRules={globalRules}
            onReset={() => onChange('injectQuotes', globalInjectQuotes)}
          />
        </div>
      )}
    </div>
  )
}

export default PostProcessingSection
