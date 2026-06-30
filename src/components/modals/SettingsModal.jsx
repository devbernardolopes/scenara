import { useModal } from '../../hooks/useModal'

function SettingsModal() {
  const { closeModal } = useModal()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
        <button
          onClick={closeModal}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <p className="text-gray-500 dark:text-gray-400 text-sm">
        Settings UI will be built here. This placeholder confirms the modal system works end-to-end.
      </p>
    </div>
  )
}

export default SettingsModal
