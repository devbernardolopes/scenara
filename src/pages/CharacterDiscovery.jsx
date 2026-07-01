import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useModal } from '../hooks/useModal'
import { getAllCharacters } from '../services/characters'
import { createThread } from '../services/threads'
import { createMessage } from '../services/messages'
import IconButton from '../components/shared/IconButton'
import Avatar from '../components/shared/Avatar'
import { Trash2, Heart, Copy, Download, UserPlus } from '../lib/icons'

function StartChatButton({ onStart, onSelectPersona }) {
  const { t } = useTranslation('common')
  return (
    <div className="flex border border-border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onStart}
        className="flex-1 min-h-[44px] px-3 text-sm font-medium text-primary hover:bg-surface-hover"
      >
        {t('discovery.startChat')}
      </button>
      <div className="w-px bg-border self-stretch" />
      <button
        type="button"
        onClick={onSelectPersona}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-secondary hover:text-text hover:bg-surface-hover"
        aria-label={t('discovery.actions.selectPersona')}
        title={t('discovery.actions.selectPersona')}
      >
        <UserPlus className="w-4 h-4" />
      </button>
    </div>
  )
}

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

  function handleEditCharacter(character) {
    openModal('characterCreate', { character })
  }

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

  function handleSelectPersona(character) {
    // Will open persona selection panel — to be implemented
  }

  function handleDelete(character) {
    // To be implemented
  }

  function handleFavorite(character) {
    // To be implemented
  }

  function handleDuplicate(character) {
    // To be implemented
  }

  function handleExport(character) {
    // To be implemented
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
            <div
              key={char.id}
              onClick={(e) => {
                if (e.target.closest('button') || e.target.closest('[data-avatar]')) return
                handleEditCharacter(char)
              }}
              className="border border-border rounded-lg p-4 bg-surface hover:shadow-surface-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-2">
                <Avatar src={char.avatar} size="lg" />
                <h3 className="font-semibold text-text truncate">{char.name}</h3>
              </div>
              <p className="text-sm text-secondary line-clamp-2 mb-3">
                {char.description || t('discovery.characterDesc')}
              </p>

              <div className="flex items-center gap-1 mb-3">
                <IconButton icon={Trash2} label={t('discovery.actions.delete')} onClick={() => handleDelete(char)} />
                <IconButton icon={Heart} label={t('discovery.actions.favorite')} onClick={() => handleFavorite(char)} />
                <IconButton icon={Copy} label={t('discovery.actions.duplicate')} onClick={() => handleDuplicate(char)} />
                <IconButton icon={Download} label={t('discovery.actions.export')} onClick={() => handleExport(char)} />
              </div>

              <StartChatButton
                onStart={() => handleSelectCharacter(char)}
                onSelectPersona={() => handleSelectPersona(char)}
              />
            </div>
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
