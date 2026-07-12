import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { getAllPersonas } from '../../services/personas'
import Avatar from './Avatar'

const PANEL_WIDTH = 256
const GAP = 8
const MARGIN = 8

function PersonaPicker({ open, onClose, onSelect, anchorRef, titleKey = 'personaPicker.title' }) {
  const { t } = useTranslation('common')
  const [personas, setPersonas] = useState([])
  const [coords, setCoords] = useState(null)
  const ref = useRef(null)
  const onCloseRef = useRef(onClose)
  const onSelectRef = useRef(onSelect)

  onCloseRef.current = onClose
  onSelectRef.current = onSelect

  useEffect(() => {
    if (open) {
      getAllPersonas().then(setPersonas)
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
      className="w-64 max-h-64 overflow-y-auto bg-surface border border-border rounded-lg shadow-surface-lg z-50 py-1"
    >
      <p className="px-3 py-2 text-xs font-medium text-tertiary uppercase tracking-wider">
        {t(titleKey)}
      </p>
      {personas.length === 0 ? (
        <p className="px-3 py-4 text-sm text-secondary text-center">{t('personaPicker.empty')}</p>
      ) : (
        personas.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectRef.current(p)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface-hover text-left min-h-[44px]"
          >
            <Avatar src={p.avatar} size="sm" />
            <span className="truncate flex-1">{p.name}</span>
            {p.isDefault ? (
              <span className="text-xs text-primary font-medium">{t('personaPicker.default')}</span>
            ) : null}
          </button>
        ))
      )}
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

export default PersonaPicker
