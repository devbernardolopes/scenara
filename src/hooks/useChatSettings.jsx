import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { getSetting } from '../services/settings'
import { DEFAULT_PP_RULES } from '../lib/postProcessing'

const VISIBILITY_KEYS = [
  'showAssistantDelete',
  'showAssistantDeleteAll',
  'showAssistantDeleteFromHere',
  'showAssistantEdit',
  'showAssistantCopy',
  'showAssistantFork',
  'showAssistantRegenerate',
  'showAssistantSpeak',
  'showAssistantPrompt',
  'showAssistantRequestDetails',
  'showAssistantDirectorDetails',
  'showAssistantVisible',
  'showUserDelete',
  'showUserDeleteAll',
  'showUserDeleteFromHere',
  'showUserEdit',
  'showUserCopy',
  'showUserFork',
  'showUserMakeShortcut',
  'showUserVisible',
]

const ALL_KEYS = [
  ...VISIBILITY_KEYS,
  'assistantButtonOrder',
  'userButtonOrder',
  'chatFontFamily',
  'chatFontSize',
  'messageBubbleSize',
  'renderMarkdown',
  'highlightLoreTriggers',
  'defaultPostProcessing',
  'postProcessingRules',
  'prompting.oocDelimiters',
]

const DEFAULT_VISIBILITY = Object.fromEntries(VISIBILITY_KEYS.map((k) => [k, true]))

const ChatSettingsContext = createContext(null)

export function ChatSettingsProvider({ children }) {
  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY)
  const [chatFontFamily, setChatFontFamily] = useState('system')
  const [chatFontSize, setChatFontSize] = useState('sm')
  const [messageBubbleSize, setMessageBubbleSize] = useState('normal')
  const [renderMarkdown, setRenderMarkdown] = useState(true)
  const [highlightLoreTriggers, setHighlightLoreTriggers] = useState(true)
  const [order, setOrder] = useState({ assistantButtonOrder: null, userButtonOrder: null })
  const [postProcessingEnabled, setPostProcessingEnabled] = useState(true)
  const [globalPPRules, setGlobalPPRules] = useState(DEFAULT_PP_RULES)
  const [oocDelimiters, setOocDelimiters] = useState(null)

  useEffect(() => {
    async function load() {
      const entries = await Promise.all(ALL_KEYS.map(async (k) => [k, await getSetting(k)]))
      const map = Object.fromEntries(entries)
      setVisibility(Object.fromEntries(VISIBILITY_KEYS.map((k) => [k, map[k]])))
      setOrder({
        assistantButtonOrder: map.assistantButtonOrder,
        userButtonOrder: map.userButtonOrder,
      })
      setChatFontFamily(map.chatFontFamily || 'system')
      setChatFontSize(map.chatFontSize || 'sm')
      setMessageBubbleSize(map.messageBubbleSize || 'normal')
      setRenderMarkdown(map.renderMarkdown !== false)
      setHighlightLoreTriggers(map.highlightLoreTriggers !== false)
      setPostProcessingEnabled(map.defaultPostProcessing !== false)
      if (
        map.postProcessingRules &&
        Array.isArray(map.postProcessingRules) &&
        map.postProcessingRules.length
      ) {
        setGlobalPPRules(map.postProcessingRules)
      }
      setOocDelimiters(map['prompting.oocDelimiters'] || null)
    }
    load()

    const VIS_SET = new Set(VISIBILITY_KEYS)
    function handler(e) {
      const key = e.detail?.key
      if (!key) return
      if (VIS_SET.has(key)) {
        getSetting(key).then((v) => setVisibility((prev) => ({ ...prev, [key]: v })))
      }
      if (key === 'assistantButtonOrder' || key === 'userButtonOrder') {
        getSetting(key).then((v) => setOrder((prev) => ({ ...prev, [key]: v })))
      }
      if (key === 'chatFontFamily') setChatFontFamily(e.detail.value || 'system')
      if (key === 'chatFontSize') setChatFontSize(e.detail.value || 'sm')
      if (key === 'messageBubbleSize') setMessageBubbleSize(e.detail.value || 'normal')
      if (key === 'renderMarkdown') setRenderMarkdown(e.detail.value !== false)
      if (key === 'highlightLoreTriggers') setHighlightLoreTriggers(e.detail.value !== false)
      if (key === 'defaultPostProcessing') setPostProcessingEnabled(e.detail.value !== false)
      if (key === 'postProcessingRules') {
        const v = e.detail.value
        if (v && Array.isArray(v) && v.length) setGlobalPPRules(v)
      }
      if (key === 'prompting.oocDelimiters') setOocDelimiters(e.detail.value || null)
    }
    window.addEventListener('settings-changed', handler)
    return () => window.removeEventListener('settings-changed', handler)
  }, [])

  const value = useMemo(
    () => ({
      visibility,
      chatFontFamily,
      chatFontSize,
      messageBubbleSize,
      renderMarkdown,
      highlightLoreTriggers,
      order,
      postProcessingEnabled,
      globalPPRules,
      oocDelimiters,
    }),
    [
      visibility,
      chatFontFamily,
      chatFontSize,
      messageBubbleSize,
      renderMarkdown,
      highlightLoreTriggers,
      order,
      postProcessingEnabled,
      globalPPRules,
      oocDelimiters,
    ],
  )

  return <ChatSettingsContext.Provider value={value}>{children}</ChatSettingsContext.Provider>
}

export function useChatSettings() {
  return useContext(ChatSettingsContext)
}
