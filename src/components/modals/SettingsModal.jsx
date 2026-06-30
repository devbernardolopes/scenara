import { useModal } from '../../hooks/useModal'
import { useTheme } from '../../hooks/useTheme'

const THEME_LABELS = {
  light: 'Light',
  dark: 'Dark',
  sepia: 'Sepia',
  pastel: 'Pastel',
  'high-contrast': 'High Contrast',
}

function SettingsModal() {
  const { closeModal } = useModal()
  const { theme, setTheme, themes } = useTheme()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text">Settings</h2>
        <button
          onClick={closeModal}
          className="text-tertiary hover:text-text"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <section className="mb-6">
        <h3 className="text-sm font-semibold text-text mb-3">Theme</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {themes.map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`px-3 py-2 rounded-md text-sm border text-left ${
                theme === t
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface text-secondary border-border hover:bg-surface-hover'
              }`}
            >
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
      </section>

      <p className="text-secondary text-sm">
        More settings coming soon.
      </p>
    </div>
  )
}

export default SettingsModal
