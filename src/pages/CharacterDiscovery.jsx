import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useModal } from '../hooks/useModal'
import { useConfirm } from '../lib/confirm'
import {
  getAllCharacters,
  deleteCharacterWithThreads,
  duplicateCharacter,
  exportCharacter,
} from '../services/characters'
import { downloadJson } from '../lib/download'
import { getSetting } from '../services/settings'
import { createThread } from '../services/threads'
import { createMessage } from '../services/messages'
import IconButton from '../components/shared/IconButton'
import Avatar from '../components/shared/Avatar'
import Pagination from '../components/shared/Pagination'
import PersonaPicker from '../components/shared/PersonaPicker'
import { Trash2, Heart, Copy, Download, UserPlus } from '../lib/icons'

function StartChatButton({ character, onStart }) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <div className="flex border border-border rounded-md overflow-hidden">
        <button
          type="button"
          onClick={() => onStart(character, null)}
          className="flex-1 min-h-[44px] px-3 text-sm font-medium text-primary hover:bg-surface-hover"
        >
          {t('discovery.startChat')}
        </button>
        <div className="w-px bg-border self-stretch" />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-secondary hover:text-text hover:bg-surface-hover"
          aria-label={t('discovery.actions.selectPersona')}
          title={t('discovery.actions.selectPersona')}
        >
          <UserPlus className="w-4 h-4" />
        </button>
      </div>
      <PersonaPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(persona) => {
          setOpen(false)
          onStart(character, persona)
        }}
      />
    </div>
  )
}

function CharacterDiscovery() {
  const { t } = useTranslation('common')
  const { openModal } = useModal()
  const navigate = useNavigate()
  const { confirm } = useConfirm()
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [cardsPerPage, setCardsPerPage] = useState(10)

  const totalPages = Math.max(1, Math.ceil(characters.length / cardsPerPage))
  const safePage = Math.min(currentPage, totalPages)
  const start = (safePage - 1) * cardsPerPage
  const visibleCharacters = characters.slice(start, start + cardsPerPage)

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalPages])

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
    getSetting('cardsPerPage').then((val) => setCardsPerPage(val || 10))
    window.addEventListener('characters-changed', loadCharacters)
    return () => window.removeEventListener('characters-changed', loadCharacters)
  }, [])

  useEffect(() => {
    function handleSettingsChanged(e) {
      if (e.detail?.key === 'cardsPerPage') {
        getSetting('cardsPerPage').then(setCardsPerPage)
      }
    }
    window.addEventListener('settings-changed', handleSettingsChanged)
    return () => window.removeEventListener('settings-changed', handleSettingsChanged)
  }, [])

  function handleEditCharacter(character) {
    openModal('characterCreate', { character })
  }

  async function handleSelectCharacter(character, persona) {
    const personaId = persona?.id || (await getSetting('defaultPersonaId'))
    const threadId = await createThread({
      characterId: character.id,
      title: character.name,
      personaId: personaId || null,
    })
    if (character.greeting) {
      await createMessage(threadId, 'assistant', character.greeting)
    }
    navigate(`/chat/${threadId}`)
  }

  async function handleDelete(character) {
    const ok = await confirm({
      title: t('discovery.confirmDelete.title'),
      message: t('discovery.confirmDelete.message', { name: character.name }),
      confirmLabel: t('discovery.confirmDelete.confirm'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    })
    if (!ok) return
    await deleteCharacterWithThreads(character.id)
    await loadCharacters()
  }

  function handleFavorite(character) {
    // To be implemented
  }

  async function handleDuplicate(character) {
    await duplicateCharacter(character.id)
  }

  async function handleExport(character) {
    const data = await exportCharacter(character.id)
    downloadJson(
      data,
      `character-${character.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}.json`,
    )
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
      {characters.length === 0 ? (
        <p className="text-secondary text-sm py-8 text-center">{t('discovery.noCharacters')}</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCharacters.map((char) => (
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

                <div className="flex items-center gap-2 mb-3">
                  <IconButton
                    icon={Trash2}
                    label={t('discovery.actions.delete')}
                    onClick={() => handleDelete(char)}
                  />
                  <IconButton
                    icon={Heart}
                    label={t('discovery.actions.favorite')}
                    onClick={() => handleFavorite(char)}
                  />
                  <IconButton
                    icon={Copy}
                    label={t('discovery.actions.duplicate')}
                    onClick={() => handleDuplicate(char)}
                  />
                  <IconButton
                    icon={Download}
                    label={t('discovery.actions.export')}
                    onClick={() => handleExport(char)}
                  />
                </div>

                <StartChatButton character={char} onStart={handleSelectCharacter} />
              </div>
            ))}
          </div>
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </>
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
