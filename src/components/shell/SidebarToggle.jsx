import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Menu } from '../../lib/icons'
import { useModal } from '../../hooks/useModal'
import { getSetting } from '../../services/settings'

const POSITION_CLASSES = {
  'bottom-left': 'bottom-24 left-4',
  'bottom-right': 'bottom-24 right-4',
  'bottom-center': 'bottom-24 left-1/2 -translate-x-1/2',
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'left-center': 'top-1/2 left-4 -translate-y-1/2',
  'right-center': 'top-1/2 right-4 -translate-y-1/2',
}

function SidebarToggle({ open, onToggle }) {
  const { t } = useTranslation('common')
  const { activeModal } = useModal()
  const [position, setPosition] = useState('bottom-left')
  const hidden = open || activeModal

  useEffect(() => {
    getSetting('sidebarTogglePosition').then((val) => setPosition(val || 'bottom-left'))
  }, [])

  useEffect(() => {
    function handleSettingsChanged(e) {
      if (e.detail?.key === 'sidebarTogglePosition') {
        getSetting('sidebarTogglePosition').then(setPosition)
      }
    }
    window.addEventListener('settings-changed', handleSettingsChanged)
    return () => window.removeEventListener('settings-changed', handleSettingsChanged)
  }, [])

  return (
    <button
      onClick={onToggle}
      className={`fixed ${POSITION_CLASSES[position] || POSITION_CLASSES['bottom-left']} z-20 md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-surface border border-border shadow-surface-md text-tertiary hover:text-text hover:bg-surface-hover transition-all duration-200 ease-in-out ${hidden ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'}`}
      aria-label={t('topbar.toggleSidebar')}
    >
      <Menu className="w-6 h-6" />
    </button>
  )
}

export default SidebarToggle
