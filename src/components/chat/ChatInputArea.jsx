import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Send,
  Square,
  MessageSquare,
  Paperclip,
  Zap,
  BookOpen,
  Mic,
  MoreHorizontal,
  ChevronDown,
  Check,
  Volume2,
  CornerDownLeft,
  Reply,
  Forward,
} from '../../lib/icons'
import Avatar from '../shared/Avatar'
import PersonaPicker from '../shared/PersonaPicker'
import { getPersona, getAllPersonas } from '../../services/personas'
import { getThread } from '../../services/threads'
import { getUIState, setUIState } from '../../services/uiState'
import { useModal } from '../../hooks/useModal'
import { getSetting } from '../../services/settings'
import { getAllInChatShortcuts } from '../../services/inChatShortcuts'
import db from '../../db'

const DEFAULT_QUICK_SETTINGS = {
  autoTTS: false,
  enterToSend: true,
  autoReply: true,
  autoSend: false,
}
const STORAGE_PREFIX = 'chatInput.'

const CHAT_BUTTON_VIS_MAP = {
  ooc: 'showChatOOC',
  attachFile: 'showChatAttachFile',
  shortcuts: 'showChatShortcuts',
  memories: 'showChatMemories',
  stt: 'showChatSTT',
  autoTTS: 'showChatAutoTTS',
  enterToSend: 'showChatEnterToSend',
  autoReply: 'showChatAutoReply',
  autoSend: 'showChatAutoSend',
}
const CHAT_BUTTON_VIS_KEYS = Object.values(CHAT_BUTTON_VIS_MAP)
const CHAT_BUTTON_ORDER_KEY = 'chatButtonOrder'
const DEFAULT_CHAT_BUTTON_ORDER = [
  'ooc',
  'attachFile',
  'shortcuts',
  'memories',
  'stt',
  'autoTTS',
  'enterToSend',
  'autoReply',
  'autoSend',
]
const TOGGLEABLE_CHAT_BUTTONS = new Set([
  'ooc',
  'shortcuts',
  'autoTTS',
  'enterToSend',
  'autoReply',
  'autoSend',
])

const CHAT_BUTTON_DEFS = {
  ooc: { icon: MessageSquare, labelKey: 'ooc' },
  attachFile: { icon: Paperclip, labelKey: 'attachFile' },
  shortcuts: { icon: Zap, labelKey: 'shortcuts' },
  memories: { icon: BookOpen, labelKey: 'memories' },
  stt: { icon: Mic, labelKey: 'stt' },
  autoTTS: { icon: Volume2, labelKey: 'quickSettings.autoTTS' },
  enterToSend: { icon: CornerDownLeft, labelKey: 'quickSettings.enterToSend' },
  autoReply: { icon: Reply, labelKey: 'quickSettings.autoReply' },
  autoSend: { icon: Forward, labelKey: 'quickSettings.autoSend' },
}

const SHORTCUT_KEYS = ['name', 'message', 'insertionType', 'autoSend', 'clearAfterSend']

function parseShortcuts(content) {
  if (typeof content !== 'string' || !content.trim()) return null
  const blocks = content.split(/\n\s*\n/)
  const result = []
  for (const raw of blocks) {
    const lines = raw.split('\n').filter((l) => l.trim() !== '')
    if (lines.length === 0) continue
    const entry = {}
    for (const line of lines) {
      const m = line.match(/^@([A-Za-z]+)=(.*)$/)
      if (!m) return null
      const k = m[1]
      if (!SHORTCUT_KEYS.includes(k)) return null
      if (k in entry) return null
      entry[k] = m[2]
    }
    if (!entry.name || !entry.message) return null
    result.push({ name: entry.name, message: entry.message })
  }
  return result.length > 0 ? result : null
}

function ChatInputArea({ threadId, onSend, onCancel, generating, summarizing, hasQueued }) {
  const { t } = useTranslation('chat')
  const { openModal } = useModal()
  const textareaRef = useRef(null)
  const promptPanelRef = useRef(null)
  const quickPanelRef = useRef(null)
  const saveTimerRef = useRef(null)
  const initializedRef = useRef(false)
  const latestRef = useRef({
    personaId: null,
    oocActive: false,
    sttActive: false,
    inputValue: '',
    quickSettings: DEFAULT_QUICK_SETTINGS,
  })

  const [inputValue, setInputValue] = useState('')
  const [oocActive, setOocActive] = useState(false)
  const [sttActive, setSttActive] = useState(false)
  const [selectedPersona, setSelectedPersona] = useState(null)
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false)
  const [quickSettings, setQuickSettings] = useState(DEFAULT_QUICK_SETTINGS)
  const [promptHistoryOpen, setPromptHistoryOpen] = useState(false)
  const [promptHistory, setPromptHistory] = useState([])
  const [personaColorMap, setPersonaColorMap] = useState({})
  const [ready, setReady] = useState(false)

  const [visibility, setVisibility] = useState(
    Object.fromEntries(CHAT_BUTTON_VIS_KEYS.map((k) => [k, true])),
  )
  const [chatOrder, setChatOrder] = useState(null)
  const [shortcutsActive, setShortcutsActive] = useState(false)
  const [shortcutsSet, setShortcutsSet] = useState(null)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [headerCount, setHeaderCount] = useState(0)
  const [overflowMenuStyle, setOverflowMenuStyle] = useState(null)
  const headerBtnRef = useRef(null)
  const overflowBtnRef = useRef(null)
  const allBtnKeyRef = useRef([])
  const prevKeyStrRef = useRef('')

  const storageKey = `${STORAGE_PREFIX}${threadId}`

  async function persistNow(overrides = {}) {
    await setUIState(storageKey, {
      personaId: selectedPersona?.id || null,
      oocActive,
      sttActive,
      inputValue,
      quickSettings,
      ...overrides,
    })
  }

  const schedulePersist = useCallback(
    (overrides = {}) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        persistNow(overrides)
      }, 400)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey, selectedPersona, oocActive, sttActive, inputValue, quickSettings],
  )

  // Load saved state on mount / thread change
  useEffect(() => {
    const keyAtMount = storageKey
    initializedRef.current = false
    setReady(false)
    let cancelled = false
    async function load() {
      const saved = await getUIState(keyAtMount)
      if (cancelled) return
      if (saved) {
        setInputValue(saved.inputValue || '')
        setOocActive(!!saved.oocActive)
        setSttActive(!!saved.sttActive)
        setQuickSettings(saved.quickSettings || DEFAULT_QUICK_SETTINGS)
        if (saved.personaId) {
          const p = await getPersona(saved.personaId)
          if (!cancelled) setSelectedPersona(p || null)
        }
      }
      if (!saved?.personaId) {
        const thread = await getThread(threadId)
        const fallbackPersonaId = thread?.personaId
        if (fallbackPersonaId) {
          const p = await getPersona(fallbackPersonaId)
          if (!cancelled) setSelectedPersona(p || null)
        } else {
          const list = await getAllPersonas()
          if (!cancelled && list.length > 0) setSelectedPersona(list[0])
        }
      }
      if (!cancelled) {
        setReady(true)
        initializedRef.current = true
        requestAnimationFrame(() => textareaRef.current && autoResize(textareaRef.current))
      }
    }
    load()
    return () => {
      cancelled = true
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      if (initializedRef.current) {
        setUIState(keyAtMount, latestRef.current)
      }
    }
  }, [threadId])

  // Sync latestRef after every render so cleanup always has freshest values
  useEffect(() => {
    latestRef.current = {
      personaId: selectedPersona?.id || null,
      oocActive,
      sttActive,
      inputValue,
      quickSettings,
    }
  })

  // Debounced save when input changes
  useEffect(() => {
    if (!ready) return
    schedulePersist()
  }, [inputValue, ready, schedulePersist])

  // Immediate save for toggles
  useEffect(() => {
    if (!ready) return
    persistNow()
  }, [oocActive, sttActive, selectedPersona, quickSettings]) // eslint-disable-line react-hooks/exhaustive-deps

  // Prompt history from promptHistory table
  useEffect(() => {
    if (!promptHistoryOpen || !threadId) return
    db.promptHistory
      .where('threadId')
      .equals(Number(threadId))
      .toArray()
      .then((entries) => {
        entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        setPromptHistory(entries)
      })
  }, [promptHistoryOpen, threadId])

  useEffect(() => {
    async function load() {
      const all = await getAllPersonas()
      const map = {}
      all.forEach((p) => {
        map[p.id] = p.color
      })
      setPersonaColorMap(map)
    }
    load()
    function handler() {
      load()
    }
    window.addEventListener('personas-changed', handler)
    return () => window.removeEventListener('personas-changed', handler)
  }, [])

  useEffect(() => {
    if (!promptHistoryOpen) return
    function handleClick(e) {
      const panel = promptPanelRef.current
      const ta = textareaRef.current
      if (panel && !panel.contains(e.target) && ta && !ta.contains(e.target)) {
        setPromptHistoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [promptHistoryOpen])

  // Load the active In-Chat Shortcuts set (first in DB)
  useEffect(() => {
    let cancelled = false
    async function load() {
      const all = await getAllInChatShortcuts()
      if (cancelled) return
      setShortcutsSet(all && all.length > 0 ? all[0] : null)
    }
    load()
    window.addEventListener('inChatShortcuts-changed', load)
    return () => {
      cancelled = true
      window.removeEventListener('inChatShortcuts-changed', load)
    }
  }, [])

  const hasShortcutsSet = Boolean(shortcutsSet)
  const parsedShortcuts = useMemo(() => {
    if (!shortcutsSet?.content) return null
    return parseShortcuts(shortcutsSet.content)
  }, [shortcutsSet])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const entries = await Promise.all(
        CHAT_BUTTON_VIS_KEYS.map(async (k) => [k, await getSetting(k)]),
      )
      const vis = Object.fromEntries(entries)
      const ord = await getSetting(CHAT_BUTTON_ORDER_KEY)
      if (!cancelled) {
        setVisibility(vis)
        setChatOrder(ord || DEFAULT_CHAT_BUTTON_ORDER)
      }
    }
    load()
    function handleChange(e) {
      const { key, value } = e.detail
      if (CHAT_BUTTON_VIS_KEYS.includes(key)) {
        setVisibility((prev) => ({ ...prev, [key]: value }))
      } else if (key === CHAT_BUTTON_ORDER_KEY) {
        setChatOrder(value || DEFAULT_CHAT_BUTTON_ORDER)
      }
    }
    window.addEventListener('settings-changed', handleChange)
    return () => {
      cancelled = true
      window.removeEventListener('settings-changed', handleChange)
    }
  }, [])

  const allButtonKeys = useMemo(() => {
    const order = chatOrder || DEFAULT_CHAT_BUTTON_ORDER
    const keys = []
    for (const key of order) {
      const visKey = CHAT_BUTTON_VIS_MAP[key]
      if (!visKey) continue
      if (!visibility[visKey]) continue
      if (!CHAT_BUTTON_DEFS[key]) continue
      keys.push(key)
    }
    return keys
  }, [chatOrder, visibility])

  useEffect(() => {
    allBtnKeyRef.current = allButtonKeys
  }, [allButtonKeys])

  useEffect(() => {
    const keyStr = allButtonKeys.join(',')
    if (keyStr !== prevKeyStrRef.current) {
      prevKeyStrRef.current = keyStr
      setHeaderCount(allButtonKeys.length)
    }
  }, [allButtonKeys])

  useEffect(() => {
    const el = headerBtnRef.current
    if (!el || allButtonKeys.length <= 1) return

    function adjust() {
      const total = allBtnKeyRef.current.length

      if (el.scrollWidth > el.clientWidth) {
        if (headerCount > 1) {
          setHeaderCount((n) => Math.max(1, n - 1))
        }
      } else if (headerCount < total) {
        const free = el.clientWidth - el.scrollWidth
        if (free >= 44) {
          setHeaderCount((n) => Math.min(total, n + 1))
        }
      }
    }

    const raf = requestAnimationFrame(adjust)
    const ro = new ResizeObserver(() => requestAnimationFrame(adjust))
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [allButtonKeys, headerCount])

  const headerKeys = allButtonKeys.slice(0, headerCount)
  const overflowKeys = allButtonKeys.slice(headerKeys.length)

  useEffect(() => {
    if (!overflowOpen) return
    function handleClick(e) {
      if (overflowBtnRef.current && !overflowBtnRef.current.contains(e.target)) {
        const panel = quickPanelRef.current
        if (panel && !panel.contains(e.target)) {
          setOverflowOpen(false)
          setOverflowMenuStyle(null)
        }
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [overflowOpen])

  useEffect(() => {
    if (!overflowOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') {
        setOverflowOpen(false)
        setOverflowMenuStyle(null)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [overflowOpen])

  const autoResize = useCallback((el) => {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  function handleSend() {
    if (generating || summarizing || hasQueued) {
      onCancel?.()
      return
    }
    const text = inputValue
    const trimmed = text.trim()
    const lower = trimmed.toLowerCase()
    const isCommand = ['/ai', '/mem', '/ooc', '/image'].includes(lower)

    if (isCommand) {
      db.promptHistory.add({
        threadId: Number(threadId),
        content: text,
        personaId: selectedPersona?.id || null,
        isCommand: true,
        createdAt: new Date(),
      })
      if (lower === '/ai') {
        onSend?.('', selectedPersona?.id, oocActive, quickSettings.autoReply)
      }
      if (lower === '/mem') {
        openModal('memory', { threadId })
      }
    } else {
      onSend?.(text, selectedPersona?.id, oocActive, quickSettings.autoReply)
    }

    setInputValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    persistNow({ inputValue: '' })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && quickSettings.enterToSend && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getToggleState = useCallback(
    (key) => {
      switch (key) {
        case 'ooc':
          return oocActive
        case 'shortcuts':
          return shortcutsActive
        case 'stt':
          return sttActive
        case 'autoTTS':
          return quickSettings.autoTTS
        case 'enterToSend':
          return quickSettings.enterToSend
        case 'autoReply':
          return quickSettings.autoReply
        case 'autoSend':
          return quickSettings.autoSend
        default:
          return false
      }
    },
    [oocActive, shortcutsActive, sttActive, quickSettings],
  )

  const toggleButton = useCallback(
    (key) => {
      switch (key) {
        case 'ooc':
          setOocActive((prev) => !prev)
          break
        case 'shortcuts':
          if (!hasShortcutsSet) {
            openModal('inChatShortcutManagement')
            return
          }
          setShortcutsActive((prev) => {
            const next = !prev
            if (next) setPromptHistoryOpen(false)
            return next
          })
          break
        case 'stt':
          setSttActive((prev) => !prev)
          break
        default:
          if (TOGGLEABLE_CHAT_BUTTONS.has(key)) {
            setQuickSettings((prev) => ({ ...prev, [key]: !prev[key] }))
          }
      }
    },
    [hasShortcutsSet, openModal],
  )

  return (
    <div className="border-t border-border p-4">
      <div className="relative max-w-4xl mx-auto">
        {/* Prompt History Panel */}
        {promptHistoryOpen && (
          <div
            ref={promptPanelRef}
            className="absolute bottom-full left-0 right-0 mb-2 max-h-60 bg-surface border border-border rounded-lg shadow-surface-lg z-50 overflow-y-auto"
          >
            <p className="px-3 py-2 text-xs font-medium text-tertiary uppercase tracking-wider sticky top-0 bg-surface z-10 border-b border-border">
              {t('promptHistory.title')}
            </p>
            {promptHistory.length === 0 ? (
              <p className="px-3 py-4 text-sm text-secondary text-center">
                {t('promptHistory.empty')}
              </p>
            ) : (
              promptHistory.map((entry) => {
                const pc =
                  !entry.isCommand && entry.personaId ? personaColorMap[entry.personaId] : null
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm text-text border-b border-border-light last:border-0 min-h-[44px] ${
                      entry.isCommand ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-surface-hover'
                    }`}
                    style={pc ? { backgroundColor: pc + '18' } : undefined}
                    onClick={() => {
                      setInputValue(entry.content)
                      setPromptHistoryOpen(false)
                      requestAnimationFrame(() => {
                        textareaRef.current?.focus()
                        if (textareaRef.current) autoResize(textareaRef.current)
                      })
                    }}
                    onDoubleClick={() => {
                      setInputValue(entry.content)
                      setPromptHistoryOpen(false)
                      if (entry.isCommand && entry.content.trim().toLowerCase() === '/ai') {
                        onSend?.('', selectedPersona?.id, oocActive, quickSettings.autoReply)
                      } else {
                        onSend?.(
                          entry.content,
                          selectedPersona?.id,
                          oocActive,
                          quickSettings.autoReply,
                        )
                      }
                      persistNow({ inputValue: '' })
                    }}
                  >
                    <span className="line-clamp-2 break-words">{entry.content}</span>
                    <span className="text-xs text-tertiary mt-0.5 block">
                      {new Date(entry.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </button>
                )
              })
            )}
            <p className="px-3 py-1.5 text-xs text-tertiary text-center border-t border-border sticky bottom-0 bg-surface">
              {t('promptHistory.hint')}
            </p>
          </div>
        )}

        {/* In-Chat Shortcuts Pills */}
        {shortcutsActive && parsedShortcuts && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-surface border border-border rounded-lg shadow-surface-lg z-50 p-3 max-h-60 overflow-y-auto">
            <div className="flex flex-wrap-reverse gap-2">
              {parsedShortcuts.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setInputValue(s.message)
                    requestAnimationFrame(() => {
                      textareaRef.current?.focus()
                      if (textareaRef.current) autoResize(textareaRef.current)
                    })
                  }}
                  className="min-h-[44px] min-w-[44px] px-3 py-2 flex items-center justify-center rounded-md bg-primary-subtle text-primary hover:bg-primary/20 text-sm break-words transition-colors"
                  title={s.message}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          data-no-autoresize
          rows={2}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={summarizing}
          onInput={(e) => autoResize(e.target)}
          onDoubleClick={() => {
            if (shortcutsActive) {
              setShortcutsActive(false)
              setPromptHistoryOpen(true)
            } else {
              setPromptHistoryOpen((prev) => !prev)
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('inputPlaceholder')}
          className={`w-full resize-none rounded-lg border px-4 py-3 pr-12 text-sm leading-relaxed transition-colors duration-150 min-h-[56px] max-h-48 focus:outline-none focus:ring-2 focus:ring-primary/30 ${
            oocActive
              ? 'bg-ooc text-ooc border-ooc placeholder-ooc'
              : 'bg-surface border-border text-text placeholder-tertiary'
          }`}
        />

        {/* Bottom bar */}
        <div className="flex flex-nowrap items-center gap-1.5 mt-2">
          {/* Left button group (overflow-aware) */}
          {allButtonKeys.length > 0 && (
            <div className="flex items-center gap-0.5 bg-surface-secondary rounded-lg px-1 py-0.5 min-w-0 flex-1">
              <div
                ref={headerBtnRef}
                className="flex items-center gap-0.5 overflow-hidden min-w-0 flex-1"
              >
                {headerKeys.map((key) => {
                  const def = CHAT_BUTTON_DEFS[key]
                  if (!def) return null
                  const Icon = def.icon
                  const isToggleable = TOGGLEABLE_CHAT_BUTTONS.has(key)
                  const isToggled = getToggleState(key)
                  const btnClass =
                    key === 'ooc'
                      ? isToggled
                        ? '!text-ooc !bg-ooc hover:!bg-ooc-hover ring-2 ring-ooc-border shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)]'
                        : ''
                      : key === 'stt'
                        ? isToggled
                          ? '!text-primary !bg-primary-subtle shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]'
                          : ''
                        : isToggleable && isToggled
                          ? '!text-primary !bg-primary-subtle shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]'
                          : ''
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (key === 'memories') openModal('memory', { threadId })
                        else toggleButton(key)
                      }}
                      className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md shrink-0 text-secondary hover:text-text hover:bg-surface-hover ${btnClass}`}
                      title={t(def.labelKey)}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  )
                })}
                {overflowKeys.length > 0 && (
                  <div className="relative flex-shrink-0">
                    <button
                      ref={overflowBtnRef}
                      type="button"
                      onClick={() => {
                        if (overflowBtnRef.current) {
                          const rect = overflowBtnRef.current.getBoundingClientRect()
                          setOverflowMenuStyle({
                            position: 'fixed',
                            bottom: window.innerHeight - rect.top + 4,
                            right: window.innerWidth - rect.right,
                            zIndex: 9999,
                          })
                        }
                        setOverflowOpen((prev) => !prev)
                      }}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-secondary hover:text-text hover:bg-surface-hover"
                      title={t('moreOptions')}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {overflowOpen && (
                      <div
                        ref={quickPanelRef}
                        style={overflowMenuStyle}
                        className="bg-surface border border-border rounded-lg shadow-surface-lg py-1 min-w-[160px] max-h-[60vh] overflow-y-auto"
                      >
                        <p className="px-3 py-1.5 text-xs font-medium text-tertiary uppercase tracking-wider">
                          {t('moreOptions')}
                        </p>
                        {overflowKeys.map((key) => {
                          const def = CHAT_BUTTON_DEFS[key]
                          if (!def) return null
                          const Icon = def.icon
                          const isToggleable = TOGGLEABLE_CHAT_BUTTONS.has(key)
                          const isToggled = getToggleState(key)
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                if (key === 'memories') {
                                  openModal('memory', { threadId })
                                  setOverflowOpen(false)
                                } else {
                                  toggleButton(key)
                                  if (!isToggleable && key !== 'stt') setOverflowOpen(false)
                                }
                              }}
                              className="w-full flex items-center justify-between px-3 py-2 text-sm text-text hover:bg-surface-hover min-h-[44px]"
                            >
                              <span className="flex items-center gap-2">
                                <Icon className="w-4 h-4" />
                                <span>{t(def.labelKey)}</span>
                              </span>
                              {isToggleable && (
                                <div
                                  className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                                    isToggled
                                      ? 'bg-primary text-on-primary'
                                      : 'bg-surface-secondary border border-border'
                                  }`}
                                >
                                  {isToggled && <Check className="w-3 h-3" />}
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Persona selector */}
          <div className="relative flex-shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => setPersonaPickerOpen((prev) => !prev)}
              onMouseDown={(e) => e.nativeEvent.stopPropagation()}
              className="flex items-center gap-1.5 min-h-[44px] px-2 rounded-md hover:bg-surface-hover text-text text-sm"
              title={t('personaSelector')}
            >
              <Avatar src={selectedPersona?.avatar} size="sm" />
              <ChevronDown className="w-3.5 h-3.5 text-tertiary" />
            </button>
            <PersonaPicker
              open={personaPickerOpen}
              titleKey="personaPicker.changeTitle"
              onClose={() => setPersonaPickerOpen(false)}
              onSelect={(p) => {
                setSelectedPersona(p)
                setPersonaPickerOpen(false)
              }}
            />
          </div>

          {/* Send / Cancel button */}
          <button
            type="button"
            onClick={handleSend}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-sm flex-shrink-0 ${
              generating || summarizing || hasQueued
                ? 'bg-error text-on-primary hover:opacity-90'
                : 'bg-primary text-on-primary hover:bg-primary-hover'
            }`}
          >
            {generating || summarizing || hasQueued ? (
              <Square className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatInputArea
