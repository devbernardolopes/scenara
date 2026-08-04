import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isValidAvatar, normalizeAvatar } from '../../../../lib/image'
import AvatarInput from '../../../shared/AvatarInput'

function formatDataSize(byteLen) {
  if (byteLen < 1024) return `${byteLen} B`
  if (byteLen < 1024 * 1024) return `${(byteLen / 1024).toFixed(1)} KB`
  return `${(byteLen / (1024 * 1024)).toFixed(1)} MB`
}

function SettingAvatarPicker({ value = '', onChange, disabled }) {
  const { t } = useTranslation('settings')
  const [draft, setDraft] = useState(value ?? '')
  const [lastValid, setLastValid] = useState(value ?? '')
  const [prevValue, setPrevValue] = useState(value ?? '')

  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(value ?? '')
    setLastValid(value ?? '')
  }

  function handleChange(next) {
    setDraft(next)
    const trimmed = normalizeAvatar(next)
    if (trimmed && !isValidAvatar(trimmed)) return
    setLastValid(trimmed)
    onChange(trimmed)
  }

  function handleBlur(normalized) {
    if (normalized && !isValidAvatar(normalized)) {
      setDraft(lastValid)
    }
  }

  return (
    <AvatarInput
      value={draft}
      onChange={handleChange}
      onBlur={handleBlur}
      inputId="system-avatar"
      placeholder={t('defaults.systemAvatar.placeholder')}
      imageDataLabel={t('defaults.systemAvatar.imageData', {
        size: formatDataSize(draft.length),
      })}
      clearLabel={t('defaults.systemAvatar.clear')}
      uploadLabel={t('uploadImage', { ns: 'common' })}
      errorText={t('common:avatar.invalid')}
      disabled={disabled}
    />
  )
}

export default SettingAvatarPicker
