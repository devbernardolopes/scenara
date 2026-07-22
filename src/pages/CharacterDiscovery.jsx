import { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useModal } from '../hooks/useModal'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { isExternalImageUrl } from '../lib/image'
import { useConfirm } from '../lib/confirm'
import {
  getAllCharacters,
  getCharacter,
  deleteCharacterWithThreads,
  duplicateCharacter,
  exportCharacter,
  getCharacterChatCounts,
} from '../services/characters'
import { downloadJson } from '../lib/download'
import { showToast } from '../lib/toast'
import { getSetting } from '../services/settings'
import { getUIState, setUIState } from '../services/uiState'
import { createThread, updateThread } from '../services/threads'
import { createMessage } from '../services/messages'
import { setBaseTitle } from '../services/titleManager'
import CollapsibleSection from '../components/shared/CollapsibleSection'
import IconButton from '../components/shared/IconButton'
import Pagination from '../components/shared/Pagination'
import ModelStatusBar from '../components/shell/ModelStatusBar'
import MarqueeText from '../components/shared/MarqueeText'
import PersonaPicker from '../components/shared/PersonaPicker'
import { getAllTags } from '../services/tags'
import {
  Trash2,
  Heart,
  Copy,
  Download,
  ChevronDown,
  MessageSquare,
  Search,
  X,
  ArrowUpDown,
  SlidersHorizontal,
} from '../lib/icons'

const SORT_OPTIONS = ['createdAt', 'updatedAt', 'lastUsed', 'chatCount', 'name']

const CARD_SIZE_GRID = {
  smaller: 'grid gap-3 sm:grid-cols-3 lg:grid-cols-4',
  small: 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
  regular: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
  large: 'grid gap-4 sm:grid-cols-1 lg:grid-cols-2',
  xlarge: 'grid gap-5 sm:grid-cols-1 lg:grid-cols-1',
}

function StartChatButton({ character, onStart, open, onToggle, onClose }) {
  const { t } = useTranslation('common')
  const anchorRef = useRef(null)

  return (
    <div className="relative" ref={anchorRef}>
      <div className="character-card__start-btn flex bg-surface-secondary rounded-md overflow-hidden">
        <button
          type="button"
          onClick={() => onStart(character, null)}
          className="flex-1 min-h-[44px] px-3 text-sm font-medium text-primary hover:bg-surface-hover"
        >
          {t('discovery.startChat')}
        </button>
        <div className="w-px bg-border-light self-stretch" />
        <button
          type="button"
          onClick={onToggle}
          onMouseDown={(e) => e.stopPropagation()}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-secondary hover:text-text hover:bg-surface-hover"
          aria-label={t('discovery.actions.selectPersona')}
          title={t('discovery.actions.selectPersona')}
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
      <PersonaPicker
        open={open}
        anchorRef={anchorRef}
        onClose={onClose}
        onSelect={(persona) => {
          onClose()
          onStart(character, persona)
        }}
      />
    </div>
  )
}

function TagRow({ tags }) {
  const rowRef = useRef(null)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = rowRef.current
    if (!el) return
    const check = () => setOverflows(el.scrollWidth > el.clientWidth)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [tags])

  return (
    <div className="relative">
      <div data-tag-row ref={rowRef} className="flex gap-1 overflow-x-auto">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="bg-on-primary/10 text-on-image text-xs rounded-full px-2 py-0.5 whitespace-nowrap shrink-0"
          >
            {tag}
          </span>
        ))}
      </div>
      {overflows && (
        <div
          className="absolute right-0 top-0 bottom-0 w-5 pointer-events-none"
          style={{
            background:
              'linear-gradient(to right, var(--color-image-scrim-fade), var(--color-image-scrim))',
          }}
        />
      )}
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
    return <span className="block font-semibold text-on-image truncate">{name}</span>
  }

  return (
    <span
      ref={wrapperRef}
      className={`block font-semibold text-on-image marquee-wrapper ${overflows ? 'marquee-animate' : ''}`}
    >
      <span className="marquee-text">{name}</span>
    </span>
  )
}

function CharacterPortraitImage({ src, alt }) {
  const [loaded, setLoaded] = useState(false)
  const online = useOnlineStatus()
  if (isExternalImageUrl(src) && !online) {
    return (
      <span className="flex items-center justify-center w-full h-full text-4xl leading-none">
        {'👤'}
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      onLoad={() => setLoaded(true)}
      className={`character-card__portrait-img w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
    />
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
  const [openPersonaFor, setOpenPersonaFor] = useState(null)
  const [cardsPerPage, setCardsPerPage] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [chatCounts, setChatCounts] = useState(new Map())
  const [tagsMap, setTagsMap] = useState(new Map())
  const [cardSize, setCardSize] = useState('regular')
  const suppressNextReloadRef = useRef(false)

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
        case 'lastUsed':
          cmp = new Date(a.lastUsedAt || a.createdAt) - new Date(b.lastUsedAt || b.createdAt)
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

  const isUnlimited = cardsPerPage === Infinity
  const totalPages = isUnlimited
    ? 1
    : Math.max(1, Math.ceil(sortedCharacters.length / cardsPerPage))
  const safePage = isUnlimited ? 1 : Math.min(currentPage, totalPages)
  const start = isUnlimited ? 0 : (safePage - 1) * cardsPerPage
  const visibleCharacters = isUnlimited
    ? sortedCharacters
    : sortedCharacters.slice(start, start + cardsPerPage)

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  async function loadCharacters(isInitial = false) {
    if (isInitial) setLoading(true)
    try {
      const [chars, counts, tags] = await Promise.all([
        getAllCharacters(),
        getCharacterChatCounts(),
        getAllTags(),
      ])
      setCharacters((prev) => {
        if (
          prev.length === chars.length &&
          prev.every((c, i) => c.id === chars[i].id && c.updatedAt === chars[i].updatedAt)
        )
          return prev
        return chars
      })
      setChatCounts((prev) => {
        if (prev.size === counts.size && [...prev.entries()].every(([k, v]) => counts.get(k) === v))
          return prev
        return counts
      })
      setTagsMap((prev) => {
        const next = new Map(tags.map((t) => [t.id, t.name]))
        if (prev.size === next.size && [...prev.entries()].every(([k, v]) => next.get(k) === v))
          return prev
        return next
      })
    } finally {
      if (isInitial) setLoading(false)
    }
  }

  async function loadTagsMap() {
    const tags = await getAllTags()
    setTagsMap(new Map(tags.map((t) => [t.id, t.name])))
  }

  async function loadChatCounts() {
    const counts = await getCharacterChatCounts()
    setChatCounts(counts)
  }

  useEffect(() => {
    function onCharactersChanged() {
      if (suppressNextReloadRef.current) {
        suppressNextReloadRef.current = false
        return
      }
      loadCharacters()
    }
    loadCharacters(true)
    getSetting('cardsPerPage').then((val) => setCardsPerPage(val || 10))
    getSetting('characterCardMarquee').then((val) => setCharacterCardMarquee(val !== false))
    getSetting('discoveryCardSize').then((val) => setCardSize(val || 'regular'))
    getUIState('discovery.sortBy').then((val) => val && setSortBy(val))
    getUIState('discovery.sortOrder').then((val) => val && setSortOrder(val))
    getUIState('discovery.searchQuery').then((val) => val && setSearchQuery(val))
    window.addEventListener('characters-changed', onCharactersChanged)
    window.addEventListener('threads-changed', loadChatCounts)
    window.addEventListener('tags-changed', loadTagsMap)
    return () => {
      window.removeEventListener('characters-changed', onCharactersChanged)
      window.removeEventListener('threads-changed', loadChatCounts)
      window.removeEventListener('tags-changed', loadTagsMap)
    }
  }, [])

  useEffect(() => {
    function handleSettingsChanged(e) {
      if (e.detail?.key === 'cardsPerPage') {
        getSetting('cardsPerPage').then(setCardsPerPage)
      }
      if (e.detail?.key === 'characterCardMarquee') {
        setCharacterCardMarquee(e.detail.value !== false)
      }
      if (e.detail?.key === 'discoveryCardSize') {
        setCardSize(e.detail.value || 'regular')
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

  async function handleEditCharacter(character) {
    const fresh = await getCharacter(character.id)
    openModal('characterCreate', { character: fresh || character })
  }

  async function createAndNavigateThread(
    character,
    persona,
    selectedScenario,
    { noScenario = false } = {},
  ) {
    const personaId = persona?.id || (await getSetting('defaultPersonaId'))
    const initialMessages = character.initialMessages?.length ? character.initialMessages : null

    const threadId = await createThread({
      characterId: character.id,
      title: new Date().toLocaleString(),
      personaId: personaId || null,
      initialMessages,
    })

    let scenarioToUse = selectedScenario
    if (!scenarioToUse && !noScenario) {
      const activeScenarioIndex = character.scenarios?.findIndex(
        (s) => s?.active && s?.content?.trim(),
      )
      if (activeScenarioIndex != null && activeScenarioIndex >= 0) {
        const active = character.scenarios[activeScenarioIndex]
        scenarioToUse = { ...active, scenarioNumber: activeScenarioIndex + 1 }
      }
    } else if (scenarioToUse) {
      const selectedIdx = character.scenarios?.findIndex((s) => s.id === scenarioToUse.id)
      scenarioToUse = { ...scenarioToUse, scenarioNumber: (selectedIdx ?? 0) + 1 }
    }

    if (scenarioToUse) {
      await updateThread(threadId, {
        activeScenario: {
          id: scenarioToUse.id,
          name: scenarioToUse.name || '',
          content: scenarioToUse.content,
          lifetime: scenarioToUse.lifetime || 'firstSummary',
          scenarioNumber: scenarioToUse.scenarioNumber,
        },
      })
    }

    if (!initialMessages && character.greeting) {
      await createMessage(threadId, 'assistant', character.greeting)
    }
    navigate(`/chat/${threadId}`)
  }

  async function handleSelectCharacter(character, persona) {
    const chatProfileId = await getSetting('requestKind.chat.profileId')
    if (!chatProfileId) {
      showToast(t('toast.chatProfileRequired', { ns: 'common' }), { type: 'warning' })
      return
    }

    const promptUser = character.promptUser !== false
    const contentScenarios = (character.scenarios || []).filter((s) => s.content?.trim())

    if (promptUser && contentScenarios.length >= 1) {
      openModal('scenarioSelector', {
        character,
        persona,
        scenarios: contentScenarios,
        onSelect: (selectedScenario) => {
          if (selectedScenario === null) {
            createAndNavigateThread(character, persona, null, { noScenario: true })
          } else {
            createAndNavigateThread(character, persona, selectedScenario)
          }
        },
        onCancel: () => {},
      })
      return
    }

    await createAndNavigateThread(character, persona, null)
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
    suppressNextReloadRef.current = true
    await deleteCharacterWithThreads(character.id)
    setCharacters((prev) => prev.filter((c) => c.id !== character.id))
    setChatCounts((prev) => {
      const next = new Map(prev)
      next.delete(character.id)
      return next
    })
  }

  function handleFavorite(_character) {
    // To be implemented
  }

  async function handleDuplicate(character) {
    const ok = await confirm({
      title: t('discovery.confirmDuplicate.title'),
      message: t('discovery.confirmDuplicate.message', { name: character.name }),
      confirmLabel: t('discovery.confirmDuplicate.confirm'),
      cancelLabel: t('cancel'),
    })
    if (!ok) return
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
          id="character-sort-select"
          name="characterSort"
          value={sortBy}
          onChange={(e) => persistSortBy(e.target.value)}
          className="min-h-[44px] px-3 py-2 text-sm bg-surface bg-surface-secondary border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-primary"
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
      <div className="shrink-0 px-4 md:px-8 pt-4 md:pt-8 pb-1">
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
          <div className="pt-1 pb-2 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary pointer-events-none" />
              <input
                id="character-search-input"
                name="characterSearch"
                autoComplete="off"
                type="text"
                value={searchQuery}
                onChange={(e) => persistSearchQuery(e.target.value)}
                placeholder={t('discovery.search.placeholder')}
                className="w-full min-h-[44px] pl-10 pr-10 text-sm bg-surface bg-surface-secondary border border-border rounded-md text-text placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => persistSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
                  aria-label={t('discovery.search.clear')}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {filterControl}
          </div>
        </CollapsibleSection>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-1 pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-secondary text-sm">{t('loading')}</p>
          </div>
        ) : sortedCharacters.length === 0 ? (
          <p className="text-secondary text-sm py-8 text-center">
            {searchQuery ? t('discovery.search.noResults') : t('discovery.noCharacters')}
          </p>
        ) : (
          <div className={CARD_SIZE_GRID[cardSize]}>
            {visibleCharacters.map((char) => {
              const displayTags = (char.tags || []).map((id) => tagsMap.get(id)).filter(Boolean)
              const chatCount = chatCounts.get(char.id) || 0
              const has1st = char.firstMessage === true
              const hasMem = char.memory && char.memory !== 'never'
              const hasDir =
                char.directorEnabled &&
                ((char.directorAutoTitleEnabled && char.directorAutoTitleInstructions?.trim()) ||
                  (char.directorSummarizationEnabled &&
                    char.directorSummarizationInstructions?.trim()) ||
                  (char.directorRegularChatEnabled &&
                    char.directorRegularChatInstructions?.trim()) ||
                  (char.directorOOCEnabled && char.directorOOCInstructions?.trim()))
              return (
                <div
                  key={char.id}
                  onClick={(e) => {
                    if (
                      e.target.closest('button') ||
                      e.target.closest('[data-avatar]') ||
                      e.target.closest('[data-tag-row]')
                    )
                      return
                    handleEditCharacter(char)
                  }}
                  className="character-card rounded-lg bg-surface shadow-surface-sm cursor-pointer flex flex-col aspect-[2/3] overflow-hidden"
                >
                  <div className="relative flex-1 overflow-hidden">
                    {char.avatar ? (
                      <CharacterPortraitImage
                        src={char.avatar}
                        alt={char.displayName || char.name}
                      />
                    ) : (
                      <div className="w-full h-full bg-surface-secondary flex items-center justify-center text-4xl">
                        {'👤'}
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-image-scrim p-3 space-y-1">
                      <CharacterNameCell
                        name={char.displayName || char.name}
                        characterCardMarquee={characterCardMarquee}
                      />
                      {char.tagline?.trim() && (
                        <div className="block">
                          <MarqueeText
                            className="text-xs text-on-image-muted"
                            marquee={characterCardMarquee}
                          >
                            {char.tagline}
                          </MarqueeText>
                        </div>
                      )}
                      {displayTags.length > 0 && <TagRow tags={displayTags} />}
                      {(chatCount > 0 || has1st || hasMem || hasDir) && (
                        <div className="flex items-center gap-1 text-on-image-muted">
                          {chatCount > 0 && (
                            <>
                              <MessageSquare className="w-3 h-3" />
                              <span className="text-xs">
                                {t('discovery.chatCount', { count: chatCount })}
                              </span>
                            </>
                          )}
                          {has1st && <span className="text-xs">1st</span>}
                          {hasMem && <span className="text-xs">Mem</span>}
                          {hasDir && <span className="text-xs">Dir</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-3 space-y-3 mt-auto">
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
                    <StartChatButton
                      character={char}
                      onStart={handleSelectCharacter}
                      open={openPersonaFor === char.id}
                      onToggle={() =>
                        setOpenPersonaFor((prev) => (prev === char.id ? null : char.id))
                      }
                      onClose={() => setOpenPersonaFor(null)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {!isUnlimited && sortedCharacters.length > 0 ? (
        // <div className="shrink-0 px-4 md:px-8 pb-4 md:pb-8 pt-4 bg-surface border-t border-border">
        <div className="shrink-0 px-4 md:px-8 pb-4 bg-surface shadow-input-area">
          <ModelStatusBar embedded />
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      ) : (
        <ModelStatusBar />
      )}
    </div>
  )
}

export default CharacterDiscovery
