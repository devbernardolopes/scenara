import SettingSlider from '../settings/controls/SettingSlider'
import SettingToggle from '../settings/controls/SettingToggle'
import StringListInput from './StringListInput'

// Renders the typed param controls for a list of param definitions (as
// declared on a provider). Shared by the connection profile form and any other
// form that edits schema-typed sampling params.
function ParamEditor({
  paramDefs,
  values,
  disabledParams = {},
  toggleableKeys = new Set(),
  formId,
  activeMethod,
  onChange,
  onToggleDisabled,
  t,
  showDescriptions = true,
}) {
  return paramDefs
    .filter((param) => {
      if (!activeMethod) return true
      const method = param.method || 'all'
      if (method === 'all') return true
      return method === activeMethod
    })
    .map((param) => {
      const isToggleable = toggleableKeys.has(param.key)
      const isDisabled = isToggleable && !!disabledParams[param.key]
      const descPath = param.descKey?.replace('settings:', '')
      return (
        <div key={param.key}>
          <div className="flex items-center justify-between mb-1">
            <label
              className={`text-xs font-medium ${isDisabled ? 'text-tertiary' : 'text-secondary'}`}
              htmlFor={param.type === 'boolean' ? undefined : formId + '-param-' + param.key}
            >
              {param.label || param.key}
            </label>
            {isToggleable && onToggleDisabled && (
              <SettingToggle value={!isDisabled} onChange={() => onToggleDisabled(param.key)} />
            )}
          </div>
          {showDescriptions && descPath && (
            <p className="text-xs text-secondary mt-0.5 mb-2">{t(descPath)}</p>
          )}
          {param.type === 'range' && (
            <SettingSlider
              id={formId + '-param-' + param.key}
              value={values[param.key] ?? param.default ?? param.min ?? 0}
              onChange={(v) => onChange(param.key, v)}
              min={param.min ?? 0}
              max={param.max ?? 100}
              step={param.step ?? 1}
              disabled={isDisabled}
            />
          )}
          {param.type === 'boolean' && (
            <SettingToggle
              value={values[param.key] ?? param.default ?? false}
              onChange={(v) => onChange(param.key, v)}
            />
          )}
          {param.type === 'string-list' && (
            <StringListInput
              id={formId + '-param-' + param.key}
              value={values[param.key] ?? []}
              onChange={(v) => onChange(param.key, v)}
              maxItems={param.maxItems}
            />
          )}
          {param.type === 'text' && (
            <input
              id={formId + '-param-' + param.key}
              type="text"
              value={values[param.key] ?? param.default ?? ''}
              onChange={(e) => onChange(param.key, e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm"
            />
          )}
        </div>
      )
    })
}

export default ParamEditor
