import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Pin, Lock, Palette, ChevronDown, Check, X } from '../../lib/icons'
import { COLOR_SLOTS, getPalette } from '../../config/colorPalettes'

export default function ThreadFilters({ filters, onFilterChange, theme }) {
  const { t } = useTranslation('common')
  const [statusOpen, setStatusOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const statusRef = useRef(null)
  const colorRef = useRef(null)

  useEffect(() => {
    if (!statusOpen && !colorOpen) return
    function handleClick(e) {
      if (statusOpen && statusRef.current && !statusRef.current.contains(e.target)) {
        setStatusOpen(false)
      }
      if (colorOpen && colorRef.current && !colorRef.current.contains(e.target)) {
        setColorOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [statusOpen, colorOpen])

  const palette = getPalette(theme)
  const hasActiveFilters =
    filters.status !== 'all' ||
    !filters.showPinned ||
    !filters.showLocked ||
    filters.colors.length > 0

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 shrink-0 flex-wrap">
      <div className="relative" ref={statusRef}>
        <button
          type="button"
          onClick={() => setStatusOpen((v) => !v)}
          className={`min-h-[32px] px-2 rounded-md text-xs flex items-center gap-1 ${
            filters.status !== 'all'
              ? 'bg-primary text-on-primary'
              : 'text-secondary hover:text-text hover:bg-surface-hover'
          }`}
          aria-label={t('sidebar.filterStatus')}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <ChevronDown className="w-3 h-3" />
        </button>
        {statusOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
            <div className="absolute left-0 top-full mt-1 w-32 bg-surface rounded-md shadow-surface-lg z-20 py-1">
              <button
                type="button"
                onClick={() => {
                  onFilterChange({ ...filters, status: 'all' })
                  setStatusOpen(false)
                }}
                className={`flex items-center gap-2 w-full min-h-[36px] px-3 text-sm ${
                  filters.status === 'all'
                    ? 'text-text font-medium'
                    : 'text-secondary hover:text-text hover:bg-surface-hover'
                }`}
              >
                {filters.status === 'all' && <Check className="w-3.5 h-3.5 shrink-0" />}
                <span className={filters.status === 'all' ? '' : 'ml-[22px]'}>
                  {t('sidebar.filterStatusAll')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onFilterChange({ ...filters, status: 'unread' })
                  setStatusOpen(false)
                }}
                className={`flex items-center gap-2 w-full min-h-[36px] px-3 text-sm ${
                  filters.status === 'unread'
                    ? 'text-text font-medium'
                    : 'text-secondary hover:text-text hover:bg-surface-hover'
                }`}
              >
                {filters.status === 'unread' && <Check className="w-3.5 h-3.5 shrink-0" />}
                <span className={filters.status === 'unread' ? '' : 'ml-[22px]'}>
                  {t('sidebar.filterStatusUnread')}
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => onFilterChange({ ...filters, showPinned: !filters.showPinned })}
        className={`min-h-[32px] px-2 rounded-md text-xs flex items-center gap-1 ${
          !filters.showPinned
            ? 'bg-primary text-on-primary'
            : 'text-secondary hover:text-text hover:bg-surface-hover'
        }`}
        aria-label={
          filters.showPinned ? t('sidebar.filterPinnedHide') : t('sidebar.filterPinnedShow')
        }
        title={filters.showPinned ? t('sidebar.filterPinnedHide') : t('sidebar.filterPinnedShow')}
      >
        <Pin className="w-3.5 h-3.5" />
        {filters.showPinned
          ? t('sidebar.filterPinnedShowLabel')
          : t('sidebar.filterPinnedHideLabel')}
      </button>

      <button
        type="button"
        onClick={() => onFilterChange({ ...filters, showLocked: !filters.showLocked })}
        className={`min-h-[32px] px-2 rounded-md text-xs flex items-center gap-1 ${
          !filters.showLocked
            ? 'bg-primary text-on-primary'
            : 'text-secondary hover:text-text hover:bg-surface-hover'
        }`}
        aria-label={
          filters.showLocked ? t('sidebar.filterLockedHide') : t('sidebar.filterLockedShow')
        }
        title={filters.showLocked ? t('sidebar.filterLockedHide') : t('sidebar.filterLockedShow')}
      >
        <Lock className="w-3.5 h-3.5" />
        {filters.showLocked
          ? t('sidebar.filterLockedShowLabel')
          : t('sidebar.filterLockedHideLabel')}
      </button>

      <div className="relative" ref={colorRef}>
        <button
          type="button"
          onClick={() => setColorOpen((v) => !v)}
          className={`min-h-[32px] px-2 rounded-md text-xs flex items-center gap-1 ${
            filters.colors.length > 0
              ? 'bg-primary text-on-primary'
              : 'text-secondary hover:text-text hover:bg-surface-hover'
          }`}
          aria-label={t('sidebar.filterColor')}
        >
          <Palette className="w-3.5 h-3.5" />
          {filters.colors.length > 0 && <span className="text-xs">{filters.colors.length}</span>}
        </button>
        {colorOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setColorOpen(false)} />
            <div className="absolute left-0 top-full mt-1 w-52 bg-surface rounded-md shadow-surface-lg z-20 p-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    onFilterChange({ ...filters, colors: [] })
                    setColorOpen(false)
                  }}
                  className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center text-[10px] font-bold ${
                    filters.colors.length === 0
                      ? 'border-text text-text'
                      : 'border-border text-tertiary hover:text-text'
                  }`}
                  aria-label={t('sidebar.filterColorAll')}
                  title={t('sidebar.filterColorAll')}
                >
                  A
                </button>
                {COLOR_SLOTS.map((slot) => {
                  const c = palette[slot]
                  const isSelected = filters.colors.includes(slot)
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        const next = isSelected
                          ? filters.colors.filter((s) => s !== slot)
                          : [...filters.colors, slot]
                        onFilterChange({ ...filters, colors: next })
                      }}
                      className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                        isSelected ? 'border-text scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={slot}
                      title={slot}
                    >
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
                      )}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => {
                    const next = filters.colors.includes('none')
                      ? filters.colors.filter((s) => s !== 'none')
                      : [...filters.colors, 'none']
                    onFilterChange({ ...filters, colors: next })
                  }}
                  className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                    filters.colors.includes('none') ? 'border-text scale-110' : 'border-border'
                  }`}
                  aria-label={t('sidebar.filterColorNone')}
                  title={t('sidebar.filterColorNone')}
                >
                  <span className="text-[9px] font-bold text-tertiary">&ndash;&ndash;</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() =>
            onFilterChange({
              status: 'all',
              showPinned: true,
              showLocked: true,
              colors: [],
            })
          }
          className="min-h-[32px] px-2 rounded-md text-xs flex items-center gap-1 text-secondary hover:text-text hover:bg-surface-hover"
          aria-label={t('sidebar.filterClear')}
          title={t('sidebar.filterClear')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
