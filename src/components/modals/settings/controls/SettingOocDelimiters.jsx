import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

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
      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
        <input
          type="text"
          value={left}
          onChange={handleLeftChange}
          disabled={!enabled}
          className="w-28 px-2 py-1.5 min-h-[44px] border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm disabled:opacity-50"
        />
        <span className="text-sm text-text whitespace-nowrap">
          {t('prompting.oocDelimiters.contentLabel')}
        </span>
        <input
          type="text"
          value={right}
          onChange={handleRightChange}
          disabled={!enabled}
          className="w-20 px-2 py-1.5 min-h-[44px] border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm disabled:opacity-50"
        />
      </div>
    </div>
  )
}

export default SettingOocDelimiters
