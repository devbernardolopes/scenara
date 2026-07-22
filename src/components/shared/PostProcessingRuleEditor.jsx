import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, ArrowUp, ArrowDown, RefreshCw } from '../../lib/icons'
import { useConfirm } from '../../lib/confirm'
import SettingSlider from '../modals/settings/controls/SettingSlider'
import { applyRulesToPlainText, DEFAULT_PP_RULES } from '../../lib/postProcessing'

const PREVIEW_TEXT = '*He stepped into the dim room* "We should leave now," she whispered softly.'

function coerceHex(color) {
  return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#888888'
}

function ChipInput({ label, values, placeholder, onAdd, onRemove }) {
  const { t } = useTranslation('settings')
  const [draft, setDraft] = useState('')

  function commit() {
    const parts = draft
      .split(/[,\n]/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (!parts.length) return
    const next = [...values]
    for (const p of parts) if (!next.includes(p)) next.push(p)
    onAdd(next)
    setDraft('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    }
  }

  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs font-medium text-secondary">{label}</label>}
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-secondary text-text text-sm shadow-surface-sm"
          >
            <span className="font-mono">{v}</span>
            <button
              type="button"
              onClick={() => onRemove(values.filter((x) => x !== v))}
              className="text-tertiary hover:text-error min-h-[24px] min-w-[24px]"
              aria-label={`${t('postProcessing.delete')} ${v}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder={placeholder}
        className="w-full px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm"
      />
    </div>
  )
}

function RuleRow({ rule, index, total, onChange, onMove, onDelete }) {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()

  function update(patch) {
    onChange({ ...rule, ...patch })
  }

  async function handleDelete() {
    const ok = await confirm({
      title: t('postProcessing.deleteConfirmTitle'),
      message: t('postProcessing.deleteConfirmMessage'),
      confirmLabel: t('postProcessing.delete'),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (!ok) return
    onDelete(index)
  }

  return (
    <div className="rounded-lg p-3 space-y-3 bg-surface shadow-surface-sm">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={rule.label || ''}
          onChange={(e) => update({ label: e.target.value })}
          placeholder={t('postProcessing.label')}
          className="flex-1 px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm"
        />
        <button
          type="button"
          onClick={handleDelete}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md border border-border text-error hover:bg-error-subtle"
          aria-label={t('postProcessing.delete')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ChipInput
          label={t('postProcessing.opening')}
          values={rule.openChars || []}
          placeholder="*"
          onAdd={(v) => update({ openChars: v })}
          onRemove={(v) => update({ openChars: v })}
        />
        <ChipInput
          label={t('postProcessing.closing')}
          values={rule.closeChars || []}
          placeholder="*"
          onAdd={(v) => update({ closeChars: v })}
          onRemove={(v) => update({ closeChars: v })}
        />
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-text">
          <span className="text-xs font-medium text-secondary">{t('postProcessing.color')}</span>
          <input
            type="color"
            value={coerceHex(rule.color)}
            onChange={(e) => update({ color: e.target.value })}
            className="w-10 h-10 rounded border border-border bg-transparent cursor-pointer"
          />
        </label>
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <span className="text-xs font-medium text-secondary shrink-0">
            {t('postProcessing.fontSize')}
          </span>
          <SettingSlider
            value={rule.fontSizePercent}
            onChange={(v) => update({ fontSizePercent: v })}
            min={50}
            max={150}
            step={5}
            formatValue={(v) => `${v}%`}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md border border-border text-secondary hover:bg-surface-hover disabled:opacity-30 disabled:pointer-events-none"
            aria-label={t('postProcessing.moveUp')}
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md border border-border text-secondary hover:bg-surface-hover disabled:opacity-30 disabled:pointer-events-none"
            aria-label={t('postProcessing.moveDown')}
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PostProcessingRuleEditor({ rules, onChange, resetToRules }) {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()

  function updateRule(index, next) {
    const copy = rules.slice()
    copy[index] = next
    onChange(copy)
  }

  function moveRule(index, dir) {
    const target = index + dir
    if (target < 0 || target >= rules.length) return
    const copy = rules.slice()
    const [item] = copy.splice(index, 1)
    copy.splice(target, 0, item)
    onChange(copy)
  }

  function deleteRule(index) {
    onChange(rules.filter((_, i) => i !== index))
  }

  function addRule() {
    onChange([
      ...rules,
      {
        id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: '',
        openChars: ['*'],
        closeChars: ['*'],
        color: '#888888',
        fontSizePercent: 100,
      },
    ])
  }

  async function resetDefaults() {
    const isOverride = Boolean(resetToRules)
    const ok = await confirm({
      title: t('postProcessing.resetConfirmTitle'),
      message: t(
        isOverride
          ? 'postProcessing.resetOverrideConfirmMessage'
          : 'postProcessing.resetConfirmMessage',
      ),
      confirmLabel: t('postProcessing.reset'),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (!ok) return
    const source = resetToRules || DEFAULT_PP_RULES
    onChange(source.map((r) => ({ ...r })))
  }

  const previewSegments = applyRulesToPlainText(PREVIEW_TEXT, rules)

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface-secondary p-3">
        <p className="text-xs font-medium text-secondary mb-2">{t('postProcessing.preview')}</p>
        <p className="whitespace-pre-wrap text-sm text-text">
          {previewSegments.map((seg, idx) =>
            seg.type === 'styled' ? (
              <span
                key={idx}
                style={{
                  color: rules[seg.ruleIndex]?.color,
                  fontSize: `${rules[seg.ruleIndex]?.fontSizePercent}%`,
                }}
              >
                {seg.content}
              </span>
            ) : (
              <span key={idx}>{seg.content}</span>
            ),
          )}
        </p>
      </div>

      <div className="space-y-3">
        {rules.map((rule, idx) => (
          <RuleRow
            key={rule.id}
            rule={rule}
            index={idx}
            total={rules.length}
            onChange={(next) => updateRule(idx, next)}
            onMove={moveRule}
            onDelete={deleteRule}
          />
        ))}
        {rules.length === 0 && (
          <p className="text-sm text-tertiary italic">{t('postProcessing.noRules')}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={addRule}
          className="min-h-[44px] px-4 py-2 rounded-md text-sm font-medium border border-border bg-surface text-text hover:bg-surface-hover inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('postProcessing.addRule')}
        </button>
        <button
          type="button"
          onClick={resetDefaults}
          className="min-h-[44px] px-4 py-2 rounded-md text-sm font-medium border border-border bg-surface text-secondary hover:bg-surface-hover inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t('postProcessing.reset')}
        </button>
      </div>
    </div>
  )
}
