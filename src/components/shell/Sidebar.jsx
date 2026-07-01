import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAllThreads } from '../../services/threads'
import { useModal } from '../../hooks/useModal'
import CloseButton from '../shared/CloseButton'
import { UserPlus } from '../../lib/icons'

function Sidebar({ open, onClose }) {
  const { t } = useTranslation('common')
  const { threadId } = useParams()
  const { openModal } = useModal()
  const [threads, setThreads] = useState([])

  async function loadThreads() {
    const all = await getAllThreads()
    setThreads(all)
  }

  useEffect(() => {
    loadThreads()
    window.addEventListener('threads-changed', loadThreads)
    return () => window.removeEventListener('threads-changed', loadThreads)
  }, [])

  return (
    <>
      {open && <div className="fixed inset-0 bg-overlay z-30 md:hidden" onClick={onClose} />}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-72 bg-surface-secondary border-r border-border
          flex flex-col
          transform transition-transform duration-200 ease-in-out
          md:relative md:transform-none md:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <Link to="/" className="font-bold text-lg text-text hover:text-text" onClick={onClose}>
            {t('appName')}
          </Link>
          <div className="md:hidden">
            <CloseButton onClick={onClose} label={t('sidebar.close')} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          <h3 className="text-xs font-semibold text-tertiary uppercase tracking-wider px-3 mb-2">
            {t('sidebar.threads')}
          </h3>
          {threads.length === 0 ? (
            <p className="text-xs text-tertiary px-3">{t('sidebar.newChat')}</p>
          ) : (
            <ul className="space-y-1">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <Link
                    to={`/chat/${thread.id}`}
                    onClick={onClose}
                    className={`flex items-center px-3 min-h-[44px] rounded-md text-sm truncate ${
                      String(thread.id) === threadId
                        ? 'bg-primary-subtle text-primary font-medium'
                        : 'text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {thread.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-3 shrink-0">
          <button
            onClick={() => openModal('personaManagement', { modalSize: 'lg' })}
            className="flex items-center gap-2 w-full min-h-[44px] px-3 rounded-md text-sm text-secondary hover:text-text hover:bg-surface-hover"
          >
            <UserPlus className="w-4 h-4" />
            {t('sidebar.personas')}
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
