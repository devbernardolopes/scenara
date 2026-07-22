import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { MessageSquare } from '../../lib/icons'
import { useModal } from '../../hooks/useModal'
import { getSetting } from '../../services/settings'
import { getUIState } from '../../services/uiState'
import { getThread } from '../../services/threads'

const POSITION_CLASSES = {
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  'top-left': 'top-24 left-4',
  'top-right': 'top-24 right-4',
  'top-center': 'top-24 left-1/2 -translate-x-1/2',
  'left-center': 'top-[calc(50%+3.5rem)] left-4',
  'right-center': 'top-[calc(50%+3.5rem)] right-4',
}

function LastChatButton({ open }) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const { activeModal } = useModal()
  const [position, setPosition] = useState('bottom-left')
  const [show, setShow] = useState(true)
  const [lastThreadId, setLastThreadId] = useState(null)

  const isChat = location.pathname.startsWith('/chat/')
  const hidden = open || activeModal || isChat

  useEffect(() => {
    getSetting('sidebarTogglePosition').then((val) => setPosition(val || 'bottom-left'))
    getSetting('showLastChatButton').then((val) => setShow(val !== false))
    getUIState('lastThreadId').then(async (id) => {
      if (id) {
        const thread = await getThread(id)
        setLastThreadId(thread ? id : null)
      }
    })
  }, [])

  useEffect(() => {
    async function handleSettingsChanged(e) {
      if (e.detail?.key === 'sidebarTogglePosition') {
        getSetting('sidebarTogglePosition').then(setPosition)
      } else if (e.detail?.key === 'showLastChatButton') {
        getSetting('showLastChatButton').then((val) => setShow(val !== false))
      }
    }
    window.addEventListener('settings-changed', handleSettingsChanged)
    return () => window.removeEventListener('settings-changed', handleSettingsChanged)
  }, [])

  useEffect(() => {
    async function refreshLastThread() {
      const id = await getUIState('lastThreadId')
      if (id) {
        const thread = await getThread(id)
        setLastThreadId(thread ? id : null)
      } else {
        setLastThreadId(null)
      }
    }
    window.addEventListener('threads-changed', refreshLastThread)
    return () => window.removeEventListener('threads-changed', refreshLastThread)
  }, [])

  if (!show || !lastThreadId) return null

  return (
    <button
      onClick={() => navigate(`/chat/${lastThreadId}`)}
      className={`fixed ${POSITION_CLASSES[position] || POSITION_CLASSES['bottom-left']} z-20 md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-surface shadow-surface-md text-tertiary hover:text-text hover:bg-surface-hover transition-all duration-200 ease-in-out ${hidden ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'}`}
      aria-label={t('topbar.lastChat')}
    >
      <MessageSquare className="w-6 h-6" />
    </button>
  )
}

export default LastChatButton
