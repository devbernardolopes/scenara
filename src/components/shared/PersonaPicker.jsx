import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getAllPersonas } from '../../services/personas'
import Avatar from './Avatar'

function PersonaPicker({ open, onClose, onSelect }) {
  const { t } = useTranslation('common')
  const [personas, setPersonas] = useState([])
  const ref = useRef(null)

  useEffect(() => {
    if (open) {
      getAllPersonas().then(setPersonas)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 right-0 w-64 max-h-64 overflow-y-auto bg-surface border border-border rounded-lg shadow-surface-lg z-50 py-1"
    >
      <p className="px-3 py-2 text-xs font-medium text-tertiary uppercase tracking-wider">
        {t('personaPicker.title')}
      </p>
      {personas.length === 0 ? (
        <p className="px-3 py-4 text-sm text-secondary text-center">{t('personaPicker.empty')}</p>
      ) : (
        personas.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
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
}

export default PersonaPicker
