import CollapsibleSection from '../../../shared/CollapsibleSection'
import AutoResizeTextarea from '../../../shared/AutoResizeTextarea'
import { estimateTokens } from '../../../../services/tokenEstimator'

function computeSummary(value, mode) {
  if (!value || !mode) return null
  const n =
    mode === 'tokens'
      ? estimateTokens(value)
      : mode === 'words'
        ? value.split(/\s+/).filter(Boolean).length
        : mode === 'characters'
          ? value.length
          : null
  return n != null ? `${n} ${mode}` : null
}

function SettingTextarea({
  value,
  onChange,
  rows = 6,
  placeholder,
  collapsible,
  summary,
  storageKey,
}) {
  const content = (
    <AutoResizeTextarea
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm resize-y"
      extraHeight={8}
    />
  )

  if (!collapsible) {
    return <div className="w-full max-w-lg">{content}</div>
  }

  return (
    <div className="w-full max-w-lg">
      <CollapsibleSection
        label=""
        summary={computeSummary(value, summary)}
        hasContent={!!value}
        storageKey={storageKey}
        defaultExpanded={true}
      >
        {content}
      </CollapsibleSection>
    </div>
  )
}

export default SettingTextarea
