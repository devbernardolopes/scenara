import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import SettingToggle from './SettingToggle'

function SettingToggleInput({ value, onChange, inline }) {
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

  if (inline) {
    return (
      <div className="flex items-center gap-2 w-full">
        <input
          type="text"
          value={text}
          onChange={handleTextChange}
          placeholder={t('prompting.toggleInputPlaceholder')}
          className="flex-1 min-w-0 px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm"
        />
        <SettingToggle value={enabled} onChange={handleEnabledChange} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <SettingToggle value={enabled} onChange={handleEnabledChange} />
      <input
        type="text"
        value={text}
        onChange={handleTextChange}
        disabled={!enabled}
        placeholder={t('prompting.toggleInputPlaceholder')}
        className="w-full px-2 py-1.5 min-h-[44px] border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm disabled:opacity-50"
      />
    </div>
  )
}

export default SettingToggleInput
