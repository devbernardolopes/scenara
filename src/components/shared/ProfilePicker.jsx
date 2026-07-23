import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getAllProfiles } from '../../services/connectionProfiles'
import { PROVIDERS } from '../../services/apiProviders'
import ProviderIcon from './ProviderIcon'

function ProfilePicker({ open, onClose, onSelect, currentId, label, triggerRef }) {
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
      if (
        ref.current &&
        !ref.current.contains(e.target) &&
        !triggerRef?.current?.contains(e.target)
      ) {
        onClose()
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [open, onClose, triggerRef])

  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    function handleScroll(e) {
      if (
        ref.current &&
        !ref.current.contains(e.target) &&
        !triggerRef?.current?.contains(e.target)
      ) {
        onClose()
      }
    }
    window.addEventListener('scroll', handleScroll, { capture: true })
    return () => window.removeEventListener('scroll', handleScroll, { capture: true })
  }, [open, onClose, triggerRef])

  useEffect(() => {
    if (!open || !ref.current) return
    const el = ref.current
    const trigger = el.parentElement
    if (!trigger) return
    const scroller = trigger.closest('.overflow-y-auto') || trigger
    const triggerRect = trigger.getBoundingClientRect()
    const scrollerRect = scroller.getBoundingClientRect()
    const panelHeight = el.offsetHeight || 256
    const spaceBelow = Math.min(scrollerRect.bottom, window.innerHeight) - triggerRect.bottom
    const spaceAbove = triggerRect.top - Math.max(scrollerRect.top, 0)
    setDropUp(spaceBelow < panelHeight + 8 && spaceAbove > spaceBelow)
  }, [open, profiles])

  if (!open) return null

  return (
    <div
      ref={ref}
      className={`absolute right-0 w-72 max-w-[calc(100vw-2rem)] max-h-64 overflow-y-auto bg-glass border-glass rounded-lg shadow-surface-lg z-50 py-1 ${
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
              <ProviderIcon
                providerId={p.providerId}
                size={16}
                className="w-4 h-4 shrink-0 text-primary"
              />
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
