import { useState, useEffect, useRef } from 'react'
import { getUIState, setUIState } from '../../services/uiState'

function CollapsibleSection({ label, summary, hasContent, storageKey, defaultExpanded = true, children }) {
  const [open, setOpen] = useState(defaultExpanded)
  const contentRef = useRef(null)
  const [contentHeight, setContentHeight] = useState(0)

  useEffect(() => {
    if (!storageKey) return
    getUIState(`collapsed.${storageKey}`).then((val) => {
      if (val !== null) setOpen(!val)
    })
  }, [storageKey])

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [children])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (storageKey) setUIState(`collapsed.${storageKey}`, !next)
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between min-h-[44px] px-3 py-2 rounded-md hover:bg-surface-hover gap-2"
      >
        <span className={`text-sm font-medium ${hasContent ? 'text-primary' : 'text-text'}`}>
          {label}
        </span>
        <span className="flex items-center gap-2">
          {summary && <span className="text-xs text-tertiary">{summary}</span>}
          <svg
            className={`w-4 h-4 text-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
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
