import { useParams } from 'react-router-dom'
import { useModal } from '../hooks/useModal'

function ChatView() {
  const { threadId } = useParams()
  const { openModal } = useModal()

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
        <h1 className="text-2xl font-bold text-text">Chat Thread {threadId}</h1>
        <p className="text-secondary">Messages will appear here.</p>
      </div>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm"
            disabled
          />
          <button
            className="px-4 py-2 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm disabled:opacity-50"
            disabled
          >
            Send
          </button>
        </div>
        <button
          onClick={() => openModal('personaEditor')}
          className="mt-2 text-xs text-tertiary hover:text-text"
        >
          Edit Persona
        </button>
      </div>
    </div>
  )
}

export default ChatView
