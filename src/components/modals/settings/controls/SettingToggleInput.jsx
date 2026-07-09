import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

function SettingToggleInput({ value, onChange }) {
  const { t } = useTranslation('settings')
  const [enabled, setEnabled] = useState(false)
  const [text, setText] = useState('')

  useEffect(() => {
    if (value) {
      setEnabled(!!value.enabled)
      setText(value.value ?? '')
    }
  }, [value])

  const handleEnabledChange = () => {
    const next = !enabled
    setEnabled(next)
    onChange({ enabled: next, value: text })
  }

  const handleTextChange = (e) => {
    const next = e.target.value
    setText(next)
    onChange({ enabled, value: next })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center min-h-[44px]">
        <button
          role="switch"
          aria-checked={enabled}
          onClick={handleEnabledChange}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
            enabled ? 'bg-primary' : 'bg-gray-300'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      <input
        type="text"
        value={text}
        onChange={handleTextChange}
        disabled={!enabled}
        placeholder={t('prompting.toggleInputPlaceholder')}
        className="w-full px-2 py-1.5 min-h-[44px] border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm disabled:opacity-50"
      />
    </div>
  )
}

export default SettingToggleInput
