import { useState, useEffect, useRef } from 'react'
import { getUIState, setUIState } from '../../services/uiState'
import { ChevronDown } from '../../lib/icons'

function CollapsibleSection({
  label,
  summary,
  hasContent,
  storageKey,
  defaultExpanded = true,
  open: controlledOpen,
  onOpenChange,
  headerExtra,
  children,
}) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(defaultExpanded)
  const open = isControlled ? controlledOpen : internalOpen
  const contentRef = useRef(null)
  const [contentHeight, setContentHeight] = useState(0)

  useEffect(() => {
    if (!storageKey || isControlled) return
    getUIState(`collapsed.${storageKey}`).then((val) => {
      if (val !== null) setInternalOpen(!val)
    })
  }, [storageKey, isControlled])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    setContentHeight(el.scrollHeight)

    const observer = new ResizeObserver(() => {
      if (contentRef.current) {
        setContentHeight(contentRef.current.scrollHeight)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const toggle = () => {
    const next = !open
    if (!isControlled) {
      setInternalOpen(next)
      if (storageKey) setUIState(`collapsed.${storageKey}`, !next)
    }
    if (onOpenChange) onOpenChange(next)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 min-h-[44px] px-3 py-2 rounded-md hover:bg-surface-hover">
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-2 min-w-0 min-h-[44px] flex-1 text-left"
        >
          <span
            className={`text-sm font-medium ${(hasContent ?? !!summary) ? 'text-highlight' : 'text-text'}`}
          >
            {label}
          </span>
        </button>
        <span className="flex items-center gap-2">
          {summary && <span className="text-xs text-tertiary">{summary}</span>}
          {headerExtra}
          <button
            type="button"
            onClick={toggle}
            className="flex items-center justify-center min-w-[44px] min-h-[44px]"
          >
            <ChevronDown
              className={`w-4 h-4 text-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </span>
      </div>
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: open ? contentHeight : 0 }}
      >
        <div ref={contentRef} className="px-3 pb-3">
          {children}
        </div>
      </div>
    </div>
  )
}

export default CollapsibleSection
