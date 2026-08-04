import { useRef } from 'react'
import Avatar from './Avatar'
import { isViewableImage, isValidAvatar } from '../../lib/image'
import { X } from '../../lib/icons'

const DEFAULT_INPUT_CLASS =
  'w-full px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm'

function AvatarInput({
  value = '',
  onChange,
  inputId,
  placeholder,
  imageDataLabel,
  clearLabel,
  uploadLabel,
  errorText,
  onZoom,
  onBlur,
  disabled = false,
  inputClass = DEFAULT_INPUT_CLASS,
}) {
  const fileRef = useRef(null)
  const trimmed = typeof value === 'string' ? value.trim() : ''
  const showError = trimmed !== '' && !isValidAvatar(value) && !disabled
  const isDataUrl = typeof value === 'string' && value.startsWith('data:')
  const inputCls = `${inputClass} pr-10 ${showError ? 'border-error' : 'border-border'}`

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result
      if (typeof dataUrl === 'string') {
        onChange(dataUrl)
      }
    }
    reader.readAsDataURL(file)
  }

  function handleBlur() {
    const normalized = typeof value === 'string' ? value.trim() : ''
    if (value !== normalized) onChange(normalized)
    if (onBlur) onBlur(normalized)
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Avatar
          src={value}
          size="2xl"
          className={`shrink-0 ${onZoom ? 'cursor-pointer' : ''}`}
          onClick={() => onZoom && isViewableImage(value) && onZoom()}
        />
        <div className="relative flex-1">
          {isDataUrl ? (
            <input
              id={inputId}
              className={inputCls}
              value={imageDataLabel}
              readOnly
              disabled={disabled}
            />
          ) : (
            <input
              id={inputId}
              className={inputCls}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={handleBlur}
              placeholder={placeholder}
              disabled={disabled}
              aria-invalid={showError}
              aria-describedby={showError ? `${inputId}-error` : undefined}
            />
          )}
          {value && !disabled && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
              aria-label={clearLabel}
              title={clearLabel}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center border border-border rounded-md text-secondary hover:text-text hover:bg-surface-hover shrink-0 disabled:opacity-40 disabled:pointer-events-none"
          aria-label={uploadLabel}
          title={uploadLabel}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12"
            />
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
          disabled={disabled}
        />
      </div>
      {showError && (
        <p id={`${inputId}-error`} className="text-xs text-error mt-1">
          {errorText}
        </p>
      )}
    </div>
  )
}

export default AvatarInput
