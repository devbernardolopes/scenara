import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getAllProfiles } from '../../services/connectionProfiles'
import { PROVIDERS } from '../../services/apiProviders'
import { SlidersHorizontal } from '../../lib/icons'

function ProfilePicker({ open, onClose, onSelect, currentId, label }) {
  const { t } = useTranslation('common')
  const [profiles, setProfiles] = useState([])
  const [dropUp, setDropUp] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    getAllProfiles().then((all) => {
      setProfiles(
        all.filter((p) => {
          const provider = PROVIDERS.find((pr) => pr.id === p.providerId)
          return !provider?.needsKey || p.keyId
        }),
      )
    })
  }, [])

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || !ref.current) return
    const el = ref.current
    const trigger = el.parentElement
    if (!trigger) return
    const scroller = trigger.closest('.overflow-y-auto') || trigger
    const triggerRect = trigger.getBoundingClientRect()
    const scrollerRect = scroller.getBoundingClientRect()
    const panelHeight = el.offsetHeight || 256
    const spaceBelow = scrollerRect.bottom - triggerRect.bottom
    const spaceAbove = triggerRect.top - scrollerRect.top
    setDropUp(spaceBelow < panelHeight + 8 && spaceAbove > spaceBelow)
  }, [open, profiles])

  if (!open) return null

  return (
    <div
      ref={ref}
      className={`absolute right-0 w-72 max-h-64 overflow-y-auto bg-surface border border-border rounded-lg shadow-surface-lg z-50 py-1 ${
        dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
      }`}
    >
      <p className="px-3 py-2 text-xs font-medium text-tertiary uppercase tracking-wider">
        {label || t('profilePicker.title')}
      </p>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left min-h-[44px] ${!currentId ? 'bg-primary-subtle text-primary' : 'text-text hover:bg-surface-hover'}`}
      >
        <span className="truncate flex-1">{t('profilePicker.none')}</span>
      </button>
      {profiles.length === 0 ? (
        <p className="px-3 py-4 text-sm text-secondary text-center">{t('profilePicker.empty')}</p>
      ) : (
        profiles.map((p) => {
          const provider = PROVIDERS.find((pr) => pr.id === p.providerId)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left min-h-[44px] ${currentId === p.id ? 'bg-primary-subtle text-primary' : 'text-text hover:bg-surface-hover'}`}
            >
              <SlidersHorizontal className="w-4 h-4 shrink-0 text-primary" />
              <div className="truncate flex-1">
                <span className="truncate block">{p.name}</span>
                <span className="text-xs text-tertiary truncate block">
                  {provider ? t(provider.nameKey) : p.providerId}
                  {p.model ? ` · ${p.model}` : ''}
                </span>
              </div>
            </button>
          )
        })
      )}
    </div>
  )
}

export default ProfilePicker
