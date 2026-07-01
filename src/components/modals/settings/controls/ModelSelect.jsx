import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Star, Check, RefreshCw } from '../../../../lib/icons'
import { getFavModels, toggleFavModel } from '../../../../services/apiProviders'

function ModelSelect({ providerId, value, onChange, models = [] }) {
  const { t } = useTranslation('settings')
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [favModels, setFavModels] = useState([])
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    getFavModels(providerId).then(setFavModels)
  }, [providerId])

  useEffect(() => {
    if (!isOpen) return
    function handleClick(e) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const allModels = [...new Set([...favModels, ...models])]

  const filtered = allModels.filter((m) => m.toLowerCase().includes(search.toLowerCase()))

  const sorted = [...filtered].sort((a, b) => {
    const aFav = favModels.includes(a)
    const bFav = favModels.includes(b)
    if (aFav && !bFav) return -1
    if (!aFav && bFav) return 1
    return a.localeCompare(b)
  })

  async function handleToggleFav(e, model) {
    e.stopPropagation()
    const updated = await toggleFavModel(providerId, model)
    setFavModels(updated)
  }

  function handleSelect(model) {
    onChange(model)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={isOpen ? search : value || ''}
        onChange={(e) => {
          if (!isOpen) setIsOpen(true)
          setSearch(e.target.value)
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={t('api.modelSearchPlaceholder')}
        className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm cursor-text"
      />
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-20 mt-1 w-full bg-surface border border-border rounded-md shadow-surface-lg max-h-72 overflow-hidden"
        >
          <div className="max-h-56 overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="px-3 py-3 text-sm text-tertiary text-center">{t('api.noModels')}</div>
            ) : (
              sorted.map((model) => {
                const isFav = favModels.includes(model)
                return (
                  <button
                    key={model}
                    type="button"
                    onClick={() => handleSelect(model)}
                    className="w-full flex items-center gap-2 px-3 py-2 min-h-[44px] text-sm text-left text-text hover:bg-surface-hover"
                  >
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => handleToggleFav(e, model)}
                      className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2"
                    >
                      <Star
                        className={`w-4 h-4 ${isFav ? 'fill-current text-yellow-500' : 'text-tertiary'}`}
                      />
                    </span>
                    <span className="flex-1 truncate">{model}</span>
                    {value === model && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              // Placeholder: will fetch models via API later
              console.log('Refresh models for', providerId)
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] text-sm border-t border-border text-secondary hover:bg-surface-hover"
          >
            <RefreshCw className="w-4 h-4" />
            {t('api.refreshModels')}
          </button>
        </div>
      )}
    </div>
  )
}

export default ModelSelect
