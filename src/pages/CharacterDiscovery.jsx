import { useModal } from '../hooks/useModal'

function CharacterDiscovery() {
  const { openModal } = useModal()

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Discovery</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        Browse and select characters to start a new chat.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-900"
          >
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Character {i}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              A brief description of this character.
            </p>
          </div>
        ))}
      </div>

      <button
        onClick={() => openModal('characterCreate')}
        className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
      >
        Create Character
      </button>
    </div>
  )
}

export default CharacterDiscovery
