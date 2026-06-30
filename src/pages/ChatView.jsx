import { useParams } from 'react-router-dom'
import { useModal } from '../hooks/useModal'

function ChatView() {
  const { threadId } = useParams()
  const { openModal } = useModal()

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Chat Thread {threadId}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Messages will appear here.
        </p>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm"
            disabled
          />
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50" disabled>
            Send
          </button>
        </div>
        <button
          onClick={() => openModal('personaEditor')}
          className="mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          Edit Persona
        </button>
      </div>
    </div>
  )
}

export default ChatView
