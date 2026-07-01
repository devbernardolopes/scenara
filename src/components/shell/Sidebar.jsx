import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAllThreads } from '../../services/threads'

function Sidebar({ open, onClose }) {
  const { t } = useTranslation('common')
  const { threadId } = useParams()
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
      {open && (
        <div
          className="fixed inset-0 bg-overlay z-30 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-72 bg-surface-secondary border-r border-border
          transform transition-transform duration-200 ease-in-out
          md:relative md:transform-none md:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Link
            to="/"
            className="font-bold text-lg text-text hover:text-text"
            onClick={onClose}
          >
            {t('appName')}
          </Link>
          <button
            onClick={onClose}
            className="text-tertiary hover:text-text md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={t('sidebar.close')}
          >
            ✕
          </button>
        </div>

        <nav className="p-4">
          <Link
            to="/"
            onClick={onClose}
            className="flex items-center px-3 min-h-[44px] rounded-md text-sm font-medium text-secondary hover:bg-surface-hover mb-2"
          >
            {t('sidebar.discovery')}
          </Link>
        </nav>

        <div className="px-4">
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
      </aside>
    </>
  )
}

export default Sidebar
