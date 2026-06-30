import { Link, useParams } from 'react-router-dom'

const THREADS = [
  { id: '1', title: 'Welcome to Scenara' },
  { id: '2', title: 'Adventure in the Dark Forest' },
  { id: '3', title: 'A Peaceful Afternoon' },
]

function Sidebar({ open, onClose }) {
  const { threadId } = useParams()

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
            Scenara
          </Link>
          <button
            onClick={onClose}
            className="text-tertiary hover:text-text md:hidden"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        <nav className="p-4">
          <Link
            to="/"
            onClick={onClose}
            className="block px-3 py-2 rounded-md text-sm font-medium text-secondary hover:bg-surface-hover mb-2"
          >
            Discovery
          </Link>
        </nav>

        <div className="px-4">
          <h3 className="text-xs font-semibold text-tertiary uppercase tracking-wider px-3 mb-2">
            Threads
          </h3>
          <ul className="space-y-1">
            {THREADS.map((thread) => (
              <li key={thread.id}>
                <Link
                  to={`/chat/${thread.id}`}
                  onClick={onClose}
                  className={`block px-3 py-2 rounded-md text-sm truncate ${
                    threadId === thread.id
                      ? 'bg-primary-subtle text-primary font-medium'
                      : 'text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {thread.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
