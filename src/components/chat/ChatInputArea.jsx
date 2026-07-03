import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Send,
  MessageSquare,
  Paperclip,
  Zap,
  BookOpen,
  Mic,
  MoreHorizontal,
  ChevronDown,
  Check,
} from '../../lib/icons'
import Avatar from '../shared/Avatar'
import PersonaPicker from '../shared/PersonaPicker'
import IconButton from '../shared/IconButton'
import { getPersona, getAllPersonas } from '../../services/personas'
import { getThread } from '../../services/threads'
import { getUIState, setUIState } from '../../services/uiState'
import db from '../../db'

const QUICK_SETTING_KEYS = ['autoTTS', 'enterToSend', 'autoReply', 'autoSend']
const DEFAULT_QUICK_SETTINGS = Object.fromEntries(
  QUICK_SETTING_KEYS.map((k) => [k, k === 'enterToSend']),
)
const STORAGE_PREFIX = 'chatInput.'

function ChatInputArea({ threadId, onSend }) {
  const { t } = useTranslation('chat')
  const textareaRef = useRef(null)
  const promptPanelRef = useRef(null)
  const quickPanelRef = useRef(null)
  const ellipsisRef = useRef(null)
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
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false)
  const [quickSettings, setQuickSettings] = useState(DEFAULT_QUICK_SETTINGS)
  const [promptHistoryOpen, setPromptHistoryOpen] = useState(false)
  const [promptHistory, setPromptHistory] = useState([])
  const [ready, setReady] = useState(false)

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
    if (!promptHistoryOpen && !quickSettingsOpen) return
    function handleClick(e) {
      if (promptHistoryOpen) {
        const panel = promptPanelRef.current
        const ta = textareaRef.current
        if (panel && !panel.contains(e.target) && ta && !ta.contains(e.target)) {
          setPromptHistoryOpen(false)
        }
      }
      if (quickSettingsOpen) {
        const panel = quickPanelRef.current
        const btn = ellipsisRef.current
        if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
          setQuickSettingsOpen(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [promptHistoryOpen, quickSettingsOpen])

  useEffect(() => {
    if (!quickSettingsOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') setQuickSettingsOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [quickSettingsOpen])

  const autoResize = useCallback((el) => {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  function handleSend() {
    const text = inputValue.trim()
    if (!text) return
    onSend?.(text, selectedPersona?.id)
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
              promptHistory.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-text hover:bg-surface-hover border-b border-border-light last:border-0 min-h-[44px]"
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
                    onSend?.(entry.content, selectedPersona?.id)
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
              ))
            )}
            <p className="px-3 py-1.5 text-xs text-tertiary text-center border-t border-border sticky bottom-0 bg-surface">
              {t('promptHistory.hint')}
            </p>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          rows={2}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onInput={(e) => autoResize(e.target)}
          onDoubleClick={() => setPromptHistoryOpen((prev) => !prev)}
          onKeyDown={handleKeyDown}
          placeholder={t('inputPlaceholder')}
          className={`w-full resize-none rounded-lg border px-4 py-3 pr-12 text-sm leading-relaxed transition-colors duration-150 min-h-[56px] max-h-48 focus:outline-none focus:ring-2 focus:ring-primary/30 ${
            oocActive
              ? 'bg-red-50 border-red-200 text-red-900 placeholder-red-400'
              : 'bg-surface border-border text-text placeholder-tertiary'
          }`}
        />

        {/* Bottom bar */}
        <div className="flex flex-nowrap items-center gap-1.5 mt-2">
          {/* Left button group */}
          <div className="flex items-center gap-0.5 bg-surface-secondary rounded-lg px-1 py-0.5 flex-shrink-0">
            <IconButton
              icon={MessageSquare}
              label={t('ooc')}
              onClick={() => setOocActive((prev) => !prev)}
              className={oocActive ? '!text-red-500 !bg-red-50 hover:!bg-red-100' : ''}
            />
            <IconButton icon={Paperclip} label={t('attachFile')} className="hidden sm:flex" />
            <IconButton icon={Zap} label={t('shortcuts')} className="hidden md:flex" />
            <IconButton icon={BookOpen} label={t('memories')} className="hidden md:flex" />
            <IconButton
              icon={Mic}
              label={t('stt')}
              onClick={() => setSttActive((prev) => !prev)}
              className={`hidden sm:flex ${sttActive ? '!text-primary !bg-primary-subtle' : ''}`}
            />
          </div>

          {/* Ellipsis quick settings */}
          <div ref={ellipsisRef} className="relative flex-shrink-0">
            <IconButton
              icon={MoreHorizontal}
              label={t('moreOptions')}
              onClick={() => setQuickSettingsOpen((prev) => !prev)}
            />
            {quickSettingsOpen && (
              <div
                ref={quickPanelRef}
                className="absolute bottom-full right-0 mb-1 w-52 bg-surface border border-border rounded-lg shadow-surface-lg z-50 py-1"
              >
                <p className="px-3 py-1.5 text-xs font-medium text-tertiary uppercase tracking-wider">
                  {t('moreOptions')}
                </p>
                {QUICK_SETTING_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setQuickSettings((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-text hover:bg-surface-hover min-h-[44px]"
                  >
                    <span>{t(`quickSettings.${key}`)}</span>
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                        quickSettings[key]
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-secondary border border-border'
                      }`}
                    >
                      {quickSettings[key] && <Check className="w-3 h-3" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1 min-w-0" />

          {/* Persona selector */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setPersonaPickerOpen((prev) => !prev)}
              className="flex items-center gap-1.5 min-h-[44px] px-2 rounded-md hover:bg-surface-hover text-text text-sm"
              title={t('personaSelector')}
            >
              <Avatar src={selectedPersona?.avatar} size="sm" />
              <ChevronDown className="w-3.5 h-3.5 text-tertiary" />
            </button>
            <PersonaPicker
              open={personaPickerOpen}
              onClose={() => setPersonaPickerOpen(false)}
              onSelect={(p) => {
                setSelectedPersona(p)
                setPersonaPickerOpen(false)
              }}
            />
          </div>

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatInputArea
