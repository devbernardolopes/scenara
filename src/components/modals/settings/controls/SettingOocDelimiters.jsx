import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import SettingToggle from './SettingToggle'

function SettingOocDelimiters({ value, onChange }) {
  const { t } = useTranslation('settings')
  const [enabled, setEnabled] = useState(false)
  const [left, setLeft] = useState('((OOC: ')
  const [right, setRight] = useState('))')

  useEffect(() => {
    if (value) {
      setEnabled(!!value.enabled)
      setLeft(value.left ?? '((OOC: ')
      setRight(value.right ?? '))')
    }
  }, [value])

  const handleEnabledChange = () => {
    const next = !enabled
    setEnabled(next)
    onChange({ enabled: next, left, right })
  }

  const handleLeftChange = (e) => {
    const next = e.target.value
    setLeft(next)
    onChange({ enabled, left: next, right })
  }

  const handleRightChange = (e) => {
    const next = e.target.value
    setRight(next)
    onChange({ enabled, left, right: next })
  }

  return (
    <div className="flex flex-col gap-2">
      <SettingToggle value={enabled} onChange={handleEnabledChange} />
      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
        <input
          type="text"
          value={left}
          onChange={handleLeftChange}
          disabled={!enabled}
          className="w-28 px-2 py-1.5 min-h-[44px] border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm disabled:opacity-50"
        />
        <span className="text-sm text-text whitespace-nowrap">
          {t('prompting.oocDelimiters.contentLabel')}
        </span>
        <input
          type="text"
          value={right}
          onChange={handleRightChange}
          disabled={!enabled}
          className="w-20 px-2 py-1.5 min-h-[44px] border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm disabled:opacity-50"
        />
      </div>
    </div>
  )
}

export default SettingOocDelimiters
