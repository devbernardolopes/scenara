import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

const PANEL_WIDTH = 256
const GAP = 8
const MARGIN = 8

function FolderPicker({ open, onClose, onSelect, anchorRef, folders, currentFolderId }) {
  const { t } = useTranslation('common')
  const [coords, setCoords] = useState(null)
  const ref = useRef(null)
  const onCloseRef = useRef(onClose)
  const onSelectRef = useRef(onSelect)

  useEffect(() => {
    onCloseRef.current = onClose
    onSelectRef.current = onSelect
  })

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
      let left = rect.right - PANEL_WIDTH
      left = Math.max(MARGIN, Math.min(left, window.innerWidth - PANEL_WIDTH - MARGIN))
      let top = rect.top - GAP
      let above = true
      if (top < MARGIN) {
        top = rect.bottom + GAP
        above = false
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

  if (!open) return null

  const content = (
    <div
      ref={ref}
      className="w-64 max-h-64 overflow-y-auto bg-glass border-glass rounded-lg shadow-surface-lg z-50 py-1"
    >
      <p className="px-3 py-2 text-xs font-medium text-tertiary uppercase tracking-wider">
        {t('discovery.folders.moveTo')}
      </p>
      <button
        type="button"
        onClick={() => onSelectRef.current(null)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left min-h-[44px] ${
          currentFolderId == null ? 'text-primary font-medium' : 'text-text hover:bg-surface-hover'
        }`}
      >
        <span className="truncate flex-1">{t('discovery.folders.none')}</span>
      </button>
      {folders.map((folder) => (
        <button
          key={folder.id}
          type="button"
          onClick={() => onSelectRef.current(folder.id)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left min-h-[44px] ${
            currentFolderId === folder.id
              ? 'text-primary font-medium'
              : 'text-text hover:bg-surface-hover'
          }`}
        >
          <span className="truncate flex-1">{folder.name}</span>
        </button>
      ))}
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
        transform: coords.above ? 'translateY(-100%)' : 'none',
      }}
    >
      {content}
    </div>,
    document.body,
  )
}

export default FolderPicker
