import { useModal } from '../../hooks/useModal'

function PersonaEditorModal() {
  const { closeModal } = useModal()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text">Edit Persona</h2>
        <button
          onClick={closeModal}
          className="text-tertiary hover:text-text"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <p className="text-secondary text-sm">Persona editor will go here.</p>
    </div>
  )
}

export default PersonaEditorModal
