import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home } from '../../lib/icons'
import { useModal } from '../../hooks/useModal'
import { getSetting } from '../../services/settings'

const HOME_POSITION_CLASSES = {
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  'top-left': 'top-24 left-4',
  'top-right': 'top-24 right-4',
  'top-center': 'top-24 left-1/2 -translate-x-1/2',
  'left-center': 'top-[calc(50%+3.5rem)] left-4',
  'right-center': 'top-[calc(50%+3.5rem)] right-4',
}

function HomeButton({ open }) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const { activeModal } = useModal()
  const [position, setPosition] = useState('bottom-left')
  const [show, setShow] = useState(true)

  const isHome = location.pathname === '/'
  const hidden = open || activeModal || isHome

  useEffect(() => {
    getSetting('sidebarTogglePosition').then((val) => setPosition(val || 'bottom-left'))
    getSetting('showHomeButton').then((val) => setShow(val !== false))
  }, [])

  useEffect(() => {
    function handleSettingsChanged(e) {
      if (e.detail?.key === 'sidebarTogglePosition') {
        getSetting('sidebarTogglePosition').then(setPosition)
      } else if (e.detail?.key === 'showHomeButton') {
        getSetting('showHomeButton').then((val) => setShow(val !== false))
      }
    }
    window.addEventListener('settings-changed', handleSettingsChanged)
    return () => window.removeEventListener('settings-changed', handleSettingsChanged)
  }, [])

  if (!show) return null

  return (
    <button
      onClick={() => navigate('/')}
      className={`fixed ${HOME_POSITION_CLASSES[position] || HOME_POSITION_CLASSES['bottom-left']} z-20 md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-surface border border-border shadow-surface-md text-tertiary hover:text-text hover:bg-surface-hover transition-all duration-200 ease-in-out ${hidden ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'}`}
      aria-label={t('topbar.home')}
    >
      <Home className="w-6 h-6" />
    </button>
  )
}

export default HomeButton
