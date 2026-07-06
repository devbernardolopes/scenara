import { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useModal } from '../hooks/useModal'
import { useConfirm } from '../lib/confirm'
import {
  getAllCharacters,
  deleteCharacterWithThreads,
  duplicateCharacter,
  exportCharacter,
  getCharacterChatCounts,
} from '../services/characters'
import { downloadJson } from '../lib/download'
import { showToast } from '../lib/toast'
import { getSetting } from '../services/settings'
import { getUIState, setUIState } from '../services/uiState'
import { createThread } from '../services/threads'
import { createMessage } from '../services/messages'
import { setBaseTitle } from '../services/titleManager'
import CollapsibleSection from '../components/shared/CollapsibleSection'
import IconButton from '../components/shared/IconButton'
import Avatar from '../components/shared/Avatar'
import Pagination from '../components/shared/Pagination'
import PersonaPicker from '../components/shared/PersonaPicker'
import {
  Trash2,
  Heart,
  Copy,
  Download,
  UserPlus,
  Search,
  ArrowUpDown,
  SlidersHorizontal,
} from '../lib/icons'

const SORT_OPTIONS = ['createdAt', 'updatedAt', 'chatCount', 'name']

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
          onMouseDown={(e) => e.stopPropagation()}
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

function CharacterNameCell({ name, characterCardMarquee }) {
  const wrapperRef = useRef(null)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = wrapperRef.current
    if (el && characterCardMarquee) {
      const overflows = el.scrollWidth > el.clientWidth
      if (overflows) {
        el.style.setProperty('--marquee-distance', `-${el.scrollWidth - el.clientWidth}px`)
      }
      setOverflows(overflows)
    } else {
      setOverflows(false)
    }
  }, [name, characterCardMarquee])

  if (!characterCardMarquee) {
    return <span className="font-semibold text-text truncate">{name}</span>
  }

  return (
    <span
      ref={wrapperRef}
      className={`font-semibold text-text marquee-wrapper ${overflows ? 'marquee-animate' : ''}`}
    >
      <span className="marquee-text">{name}</span>
    </span>
  )
}

function CharacterDiscovery() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const { openModal } = useModal()

  useEffect(() => {
    setBaseTitle('Scenara')
  }, [])
  const { confirm } = useConfirm()
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const [characterCardMarquee, setCharacterCardMarquee] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [cardsPerPage, setCardsPerPage] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [chatCounts, setChatCounts] = useState(new Map())

  const filteredCharacters = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return characters
    return characters.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.tagline || c.description || '').toLowerCase().includes(q) ||
        (c.prompt || c.personality || '').toLowerCase().includes(q),
    )
  }, [characters, searchQuery])

  const sortedCharacters = useMemo(() => {
    const list = [...filteredCharacters]
    list.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'createdAt':
          cmp = new Date(a.createdAt) - new Date(b.createdAt)
          break
        case 'updatedAt':
          cmp = new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt)
          break
        case 'chatCount':
          cmp = (chatCounts.get(a.id) || 0) - (chatCounts.get(b.id) || 0)
          break
        case 'name':
          cmp = (a.name || '').localeCompare(b.name || '')
          break
      }
      return sortOrder === 'desc' ? -cmp : cmp
    })
    return list
  }, [filteredCharacters, sortBy, sortOrder, chatCounts])

  const totalPages = Math.max(1, Math.ceil(sortedCharacters.length / cardsPerPage))
  const safePage = Math.min(currentPage, totalPages)
  const start = (safePage - 1) * cardsPerPage
  const visibleCharacters = sortedCharacters.slice(start, start + cardsPerPage)

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  async function loadCharacters() {
    setLoading(true)
    try {
      const [chars, counts] = await Promise.all([getAllCharacters(), getCharacterChatCounts()])
      setCharacters(chars)
      setChatCounts(counts)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCharacters()
    getSetting('cardsPerPage').then((val) => setCardsPerPage(val || 10))
    getSetting('characterCardMarquee').then((val) => setCharacterCardMarquee(val !== false))
    getUIState('discovery.sortBy').then((val) => val && setSortBy(val))
    getUIState('discovery.sortOrder').then((val) => val && setSortOrder(val))
    getUIState('discovery.searchQuery').then((val) => val && setSearchQuery(val))
    window.addEventListener('characters-changed', loadCharacters)
    return () => window.removeEventListener('characters-changed', loadCharacters)
  }, [])

  useEffect(() => {
    function handleSettingsChanged(e) {
      if (e.detail?.key === 'cardsPerPage') {
        getSetting('cardsPerPage').then(setCardsPerPage)
      }
      if (e.detail?.key === 'characterCardMarquee') {
        setCharacterCardMarquee(e.detail.value !== false)
      }
    }
    window.addEventListener('settings-changed', handleSettingsChanged)
    return () => window.removeEventListener('settings-changed', handleSettingsChanged)
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sortBy, sortOrder])

  const persistSortBy = useCallback((val) => {
    setSortBy(val)
    setUIState('discovery.sortBy', val)
  }, [])

  const persistSortOrder = useCallback((val) => {
    setSortOrder(val)
    setUIState('discovery.sortOrder', val)
  }, [])

  const persistSearchQuery = useCallback((val) => {
    setSearchQuery(val)
    setUIState('discovery.searchQuery', val)
  }, [])

  function handleImageClick(src) {
    if (src) openModal('imageViewer', { src, modalSize: 'fullscreen' })
  }

  function handleEditCharacter(character) {
    openModal('characterCreate', { character })
  }

  async function handleSelectCharacter(character, persona) {
    const chatProfileId = await getSetting('requestKind.chat.profileId')
    if (!chatProfileId) {
      showToast(t('toast.chatProfileRequired', { ns: 'common' }), { type: 'warning' })
      return
    }
    const personaId = persona?.id || (await getSetting('defaultPersonaId'))
    const initialMessages = character.initialMessages?.length ? character.initialMessages : null

    const threadId = await createThread({
      characterId: character.id,
      title: new Date().toLocaleString(),
      personaId: personaId || null,
      initialMessages,
    })

    if (!initialMessages && character.greeting) {
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

  function handleFavorite(_character) {
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

  const filterControl = (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-secondary whitespace-nowrap">
          {t('discovery.sort.label')}
        </span>
        <select
          value={sortBy}
          onChange={(e) => persistSortBy(e.target.value)}
          className="min-h-[44px] px-3 py-2 text-sm bg-surface border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {SORT_OPTIONS.map((key) => (
            <option key={key} value={key}>
              {t(`discovery.sort.${key}`)}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => persistSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-3 border border-border rounded-md text-sm text-text hover:bg-surface-hover"
        title={t(`discovery.order.${sortOrder === 'asc' ? 'desc' : 'asc'}`)}
      >
        <ArrowUpDown className="w-4 h-4" />
        <span className="text-xs text-secondary">{t(`discovery.order.${sortOrder}`)}</span>
      </button>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 md:px-8 pt-4 md:pt-8 pb-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => persistSearchQuery(e.target.value)}
            placeholder={t('discovery.search.placeholder')}
            className="w-full min-h-[44px] pl-10 pr-4 text-sm bg-surface border border-border rounded-md text-text placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="shrink-0 px-4 md:px-8 pt-2 pb-1">
        <CollapsibleSection
          label={
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              {t('discovery.filter.title')}
            </span>
          }
          summary={
            searchQuery || sortBy !== 'createdAt' || sortOrder !== 'desc'
              ? t('discovery.filter.active', { count: 1 })
              : ''
          }
          storageKey="discoveryFilters"
          defaultExpanded={false}
        >
          <div className="pt-1 pb-2">{filterControl}</div>
        </CollapsibleSection>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-secondary text-sm">{t('loading')}</p>
          </div>
        ) : sortedCharacters.length === 0 ? (
          <p className="text-secondary text-sm py-8 text-center">
            {searchQuery ? t('discovery.search.noResults') : t('discovery.noCharacters')}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCharacters.map((char) => (
              <div
                key={char.id}
                onClick={(e) => {
                  if (e.target.closest('button') || e.target.closest('[data-avatar]')) return
                  handleEditCharacter(char)
                }}
                className="border border-border rounded-lg p-4 bg-surface hover:shadow-surface-md transition-shadow cursor-pointer flex flex-col"
              >
                <div className="flex items-center gap-3 mb-2">
                  <Avatar
                    src={char.avatar}
                    size="lg"
                    onClick={() => handleImageClick(char.avatar)}
                  />
                  <div className="flex items-center gap-2 min-w-0">
                    <CharacterNameCell
                      name={char.name}
                      characterCardMarquee={characterCardMarquee}
                    />
                    <span className="text-xs text-tertiary shrink-0">#{char.characterNumber}</span>
                  </div>
                </div>
                {(char.tagline || char.description) && (
                  <p className="text-sm text-secondary line-clamp-2 mb-3">
                    {char.tagline || char.description}
                  </p>
                )}

                <div className="mt-auto space-y-3">
                  <div className="flex items-center gap-2">
                    <IconButton
                      icon={Trash2}
                      label={t('discovery.actions.delete')}
                      onClick={() => handleDelete(char)}
                      className="bg-delete text-on-delete hover:bg-delete-hover"
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
              </div>
            ))}
          </div>
        )}
      </div>
      {sortedCharacters.length > 0 && (
        <div className="shrink-0 px-4 md:px-8 pb-4 md:pb-8 pt-4 bg-surface border-t border-border">
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  )
}

export default CharacterDiscovery
