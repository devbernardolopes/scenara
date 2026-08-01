import { useState } from 'react'
import { useTranslation } from 'react-i18next'

function StringListInput({ value, onChange, maxItems, id }) {
  const { t } = useTranslation('settings')
  const [input, setInput] = useState('')
  const items = Array.isArray(value) ? value : []

  function handleAdd() {
    const raw = input.trim()
    if (!raw) return
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    const available = maxItems ? maxItems - items.length : Infinity
    const toAdd = parts.slice(0, available)
    if (toAdd.length === 0) return
    onChange([...items, ...toAdd])
    setInput('')
  }

  function handleRemove(idx) {
    const next = items.filter((_, i) => i !== idx)
    onChange(next)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  const atLimit = maxItems && items.length >= maxItems

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-primary-subtle text-primary"
          >
            {item}
            <button
              type="button"
              onClick={() => handleRemove(idx)}
              className="hover:bg-delete-hover hover:text-on-delete rounded-sm px-0.5"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          id={id}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={atLimit}
          placeholder={atLimit ? t('api.profile.maxStopItems') : t('api.profile.addStopItem')}
          className="flex-1 min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim() || atLimit}
          className="min-h-[44px] px-3 text-sm btn-primary disabled:opacity-50"
        >
          {t('api.profile.add')}
        </button>
      </div>
    </div>
  )
}

export default StringListInput
