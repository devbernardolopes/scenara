import { useState, useRef, useEffect } from 'react'

function clampAndSnap(v, min, max, step) {
  const clamped = Math.min(max, Math.max(min, v))
  const snapped = Math.round((clamped - min) / step) * step + min
  const rounded = parseFloat(snapped.toPrecision(12))
  return Math.min(max, Math.max(min, rounded))
}

function formatDisplay(value, step, formatValue) {
  if (formatValue) return formatValue(value)
  if (step < 1) return Number(value).toFixed(2)
  return value
}

function SettingSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  formatValue,
  disabled,
  label,
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef(null)
  const inputCallbackRef = useRef(null)

  useEffect(() => {
    inputCallbackRef.current = inputRef.current
  })

  useEffect(() => {
    if (editing && inputCallbackRef.current) {
      inputCallbackRef.current.focus()
      inputCallbackRef.current.select()
    }
  }, [editing])

  function startEditing() {
    if (disabled) return
    setEditValue(String(value))
    setEditing(true)
  }

  function commitEdit() {
    const parsed = parseFloat(editValue)
    if (Number.isNaN(parsed)) {
      setEditing(false)
      return
    }
    const final = clampAndSnap(parsed, min, max, step)
    onChange(final)
    setEditing(false)
  }

  function cancelEdit() {
    setEditing(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  const displayValue = formatDisplay(value, step, formatValue)

  return (
    <div className="flex items-center gap-3 min-h-[44px]">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        onTouchStart={(e) => {
          e.stopPropagation()
          if (
            document.activeElement &&
            document.activeElement !== e.target &&
            document.activeElement.tagName !== 'BODY'
          ) {
            document.activeElement.blur()
          }
        }}
        onTouchEnd={(e) => e.stopPropagation()}
        className="w-48 accent-primary disabled:opacity-40"
      />
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitEdit}
          aria-label={label}
          className="w-14 text-sm text-right font-medium bg-transparent border-b border-accent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      ) : (
        <span
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={startEditing}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              startEditing()
            }
          }}
          className={`text-sm text-text font-medium w-14 text-right${disabled ? ' opacity-40' : ' cursor-pointer hover:text-accent'}`}
        >
          {displayValue}
        </span>
      )}
    </div>
  )
}

export default SettingSlider
