import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Square } from '../../../../lib/icons'
import { createTestNotificationSound } from '../../../../services/unread'

function NotificationSoundTestButton({ value, disabled }) {
  const { t } = useTranslation('settings')
  const [isPlaying, setIsPlaying] = useState(false)
  const soundRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (e.detail.key === 'unreadSound' && !e.detail.value && soundRef.current) {
        soundRef.current.stop()
        setIsPlaying(false)
      }
    }
    window.addEventListener('settings-changed', handler)
    return () => window.removeEventListener('settings-changed', handler)
  }, [])

  const handleToggle = useCallback(() => {
    if (isPlaying) {
      soundRef.current?.stop()
      setIsPlaying(false)
    } else {
      const sound = createTestNotificationSound()
      soundRef.current = sound
      setIsPlaying(true)
      sound.play(() => setIsPlaying(false))
    }
  }, [isPlaying])

  const isDisabled = disabled || !value
  const Icon = isPlaying ? Square : Play

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isDisabled}
      title={isPlaying ? t('unreadSound.testStop') : t('unreadSound.testPlay')}
      className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md transition-colors duration-200 ${
        isDisabled
          ? 'text-tertiary cursor-not-allowed'
          : 'text-secondary hover:text-text hover:bg-surface-hover'
      }`}
    >
      <Icon size={18} />
    </button>
  )
}

export default NotificationSoundTestButton
