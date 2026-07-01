import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useModal } from '../hooks/useModal'
import { getAllCharacters } from '../services/characters'
import { createThread } from '../services/threads'
import { createMessage } from '../services/messages'

function CharacterDiscovery() {
  const { t } = useTranslation('common')
  const { openModal } = useModal()
  const navigate = useNavigate()
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadCharacters() {
    setLoading(true)
    try {
      const chars = await getAllCharacters()
      setCharacters(chars)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCharacters()
    window.addEventListener('characters-changed', loadCharacters)
    return () => window.removeEventListener('characters-changed', loadCharacters)
  }, [])

  async function handleSelectCharacter(character) {
    const threadId = await createThread({
      characterId: character.id,
      title: character.name,
    })
    if (character.greeting) {
      await createMessage(threadId, 'assistant', character.greeting)
    }
    window.dispatchEvent(new CustomEvent('threads-changed'))
    navigate(`/chat/${threadId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary text-sm">{t('loading')}</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-text mb-2">{t('discovery.title')}</h1>
      <p className="text-secondary mb-6">{t('discovery.subtitle')}</p>

      {characters.length === 0 ? (
        <p className="text-secondary text-sm py-8 text-center">{t('discovery.noCharacters')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((char) => (
            <button
              key={char.id}
              onClick={() => handleSelectCharacter(char)}
              className="text-left border border-border rounded-lg p-4 hover:shadow-surface-md transition-shadow cursor-pointer bg-surface hover:bg-surface-hover"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">{char.avatar || '👤'}</span>
                <h3 className="font-semibold text-text">{char.name}</h3>
              </div>
              <p className="text-sm text-secondary line-clamp-2">
                {char.description || t('discovery.characterDesc')}
              </p>
              <span className="inline-block mt-3 text-xs text-primary font-medium">
                {t('discovery.startChat')} →
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => openModal('characterCreate')}
        className="mt-6 min-h-[44px] px-4 py-2 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm"
      >
        {t('discovery.createCharacter')}
      </button>
    </div>
  )
}

export default CharacterDiscovery
