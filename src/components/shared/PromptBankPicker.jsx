import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { getAllPromptBankEntries } from '../../services/promptBank'
import { useModal } from '../../hooks/useModal'
import { Database, Search } from '../../lib/icons'

const PANEL_WIDTH = 280
const GAP = 8
const MARGIN = 8

function PromptBankPicker({ open, onClose, onSelect, anchorRef }) {
  const { t } = useTranslation('settings')
  const { openModal } = useModal()
  const [entries, setEntries] = useState([])
  const [search, setSearch] = useState('')
  const [coords, setCoords] = useState(null)
  const ref = useRef(null)
  const onCloseRef = useRef(onClose)
  const onSelectRef = useRef(onSelect)
  const searchRef = useRef(null)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    if (open) {
      getAllPromptBankEntries().then(setEntries)
      setSearch('')
    }
  }, [open])

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleMousedown(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onCloseRef.current()
      }
    }
    document.addEventListener('mousedown', handleMousedown)
    return () => document.removeEventListener('mousedown', handleMousedown)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  useEffect(() => {
    if (!open || !anchorRef) {
      setCoords(null)
      return
    }
    function compute() {
      const el = anchorRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      let left = rect.left
      left = Math.max(MARGIN, Math.min(left, window.innerWidth - PANEL_WIDTH - MARGIN))
      let top = rect.bottom + GAP
      let above = false
      if (top + 320 > window.innerHeight - MARGIN) {
        top = rect.top - GAP
        above = true
      }
      setCoords({ left, top, above })
    }
    compute()
    function handleScroll() {
      onCloseRef.current()
    }
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', compute)
    }
  }, [anchorRef, open])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.kind && e.kind.toLowerCase().includes(q)) ||
        (e.content && e.content.toLowerCase().includes(q)),
    )
  }, [entries, search])

  const grouped = useMemo(() => {
    const groups = new Map()
    for (const entry of filtered) {
      const kind = entry.kind || ''
      if (!groups.has(kind)) groups.set(kind, [])
      groups.get(kind).push(entry)
    }
    return groups
  }, [filtered])

  const handleSelect = useCallback((entry) => {
    onSelectRef.current(entry.content || '')
    onCloseRef.current()
  }, [])

  const handleManage = useCallback(() => {
    onCloseRef.current()
    openModal('promptBankManagement')
  }, [openModal])

  if (!open) return null

  const content = (
    <div
      ref={ref}
      className="w-[280px] max-h-80 flex flex-col bg-surface border border-border rounded-lg shadow-surface-lg z-50"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search className="w-3.5 h-3.5 text-tertiary shrink-0" />
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('promptBank.picker.searchPlaceholder')}
          className="flex-1 bg-transparent text-sm text-text placeholder-tertiary outline-none min-w-0"
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-secondary text-center">
            {t('promptBank.picker.empty')}
          </p>
        ) : (
          [...grouped.entries()].map(([kind, items]) => (
            <div key={kind || '__none__'}>
              {kind && (
                <p className="px-3 py-1.5 text-xs font-medium text-tertiary uppercase tracking-wider bg-surface-secondary sticky top-0">
                  {kind}
                </p>
              )}
              {items.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleSelect(entry)}
                  className="w-full flex flex-col px-3 py-2 text-left hover:bg-surface-hover min-h-[44px] justify-center"
                >
                  <span className="text-sm font-medium text-text truncate">{entry.name}</span>
                  {entry.content && (
                    <span className="text-xs text-tertiary truncate mt-0.5">
                      {entry.content.slice(0, 80)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))
        )}
      </div>
      <button
        type="button"
        onClick={handleManage}
        className="flex items-center justify-center gap-1.5 px-3 py-2 border-t border-border text-xs text-secondary hover:text-text hover:bg-surface-hover min-h-[44px] shrink-0"
      >
        <Database className="w-3 h-3" />
        {t('promptBank.picker.manage')}
      </button>
    </div>
  )

  if (!anchorRef) {
    return <div className="absolute bottom-full mb-2 right-0">{content}</div>
  }

  if (!coords) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: coords.left,
        top: coords.top,
        width: PANEL_WIDTH,
        ...(coords.above ? { transform: 'translateY(-100%)' } : {}),
      }}
    >
      {content}
    </div>,
    document.body,
  )
}

export default PromptBankPicker
