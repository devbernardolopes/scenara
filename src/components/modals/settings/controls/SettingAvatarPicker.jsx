import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Avatar from '../../../shared/Avatar'

function SettingAvatarPicker({ value, onChange, disabled }) {
  const { t } = useTranslation('settings')
  const fileRef = useRef(null)

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

  const inputClass =
    'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

  return (
    <div className="flex items-center gap-2">
      <Avatar src={value} size="xl" className="shrink-0" />
      <input
        className={`${inputClass} flex-1`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('defaults.systemAvatar.placeholder')}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={disabled}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center border border-border rounded-md text-secondary hover:text-text hover:bg-surface-hover shrink-0 disabled:opacity-40 disabled:pointer-events-none"
        aria-label={t('uploadImage', { ns: 'common' })}
        title={t('uploadImage', { ns: 'common' })}
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
  )
}

export default SettingAvatarPicker
