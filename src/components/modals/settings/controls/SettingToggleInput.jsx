import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import SettingToggle from './SettingToggle'

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
      <SettingToggle value={enabled} onChange={handleEnabledChange} />
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
