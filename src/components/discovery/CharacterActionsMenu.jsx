import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Heart, FolderPlus, Copy, Download, Trash2 } from '../../lib/icons'

const PANEL_WIDTH = 224
const PANEL_HEIGHT_ESTIMATE = 288
const GAP = 8
const MARGIN = 8

function CharacterActionsMenu({
  open,
  onClose,
  anchorRef,
  character,
  folders,
  onFavorite,
  onMoveToFolder,
  onDuplicate,
  onExport,
  onDelete,
}) {
  const { t } = useTranslation('common')
  const [coords, setCoords] = useState(null)
  const [showFolders, setShowFolders] = useState(false)
  const ref = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    function handleMousedown(e) {
      if (ref.current && ref.current.contains(e.target)) return
      if (anchorRef && anchorRef.current && anchorRef.current.contains(e.target)) return
      onCloseRef.current()
    }
    document.addEventListener('mousedown', handleMousedown)
    return () => document.removeEventListener('mousedown', handleMousedown)
  }, [anchorRef, open])

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
      let top = rect.bottom + GAP
      let above = false
      if (top + PANEL_HEIGHT_ESTIMATE > window.innerHeight - MARGIN) {
        top = rect.top - GAP
        above = true
      }
      top = Math.max(MARGIN, top)
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

  useEffect(() => {
    if (!open) setShowFolders(false)
  }, [open])

  if (!open) return null

  const content = (
    <div
      ref={ref}
      className="w-56 max-h-72 overflow-y-auto bg-glass border-glass rounded-lg shadow-surface-lg z-50 py-1"
    >
      {showFolders ? (
        <>
          <button
            type="button"
            onClick={() => setShowFolders(false)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left min-h-[44px] text-text hover:bg-surface-hover"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="truncate flex-1">{t('discovery.folders.moveTo')}</span>
          </button>
          <div className="h-px bg-border-light my-1" />
          <button
            type="button"
            onClick={() => {
              onMoveToFolder(null)
              onCloseRef.current()
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left min-h-[44px] ${
              character.folderId == null
                ? 'text-primary font-medium'
                : 'text-text hover:bg-surface-hover'
            }`}
          >
            <span className="truncate flex-1">{t('discovery.folders.none')}</span>
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => {
                onMoveToFolder(folder.id)
                onCloseRef.current()
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left min-h-[44px] ${
                character.folderId === folder.id
                  ? 'text-primary font-medium'
                  : 'text-text hover:bg-surface-hover'
              }`}
            >
              <span className="truncate flex-1">{folder.name}</span>
            </button>
          ))}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              onFavorite(character)
              onCloseRef.current()
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left min-h-[44px] ${
              character.isFavorite ? 'text-favorite' : 'text-text hover:bg-surface-hover'
            }`}
          >
            <Heart className={`w-4 h-4 ${character.isFavorite ? 'fill-current' : ''}`} />
            <span className="truncate flex-1">
              {character.isFavorite
                ? t('discovery.actions.unfavorite')
                : t('discovery.actions.favorite')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowFolders(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left min-h-[44px] text-text hover:bg-surface-hover"
          >
            <FolderPlus className="w-4 h-4" />
            <span className="truncate flex-1">{t('discovery.actions.moveToFolder')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onDuplicate(character)
              onCloseRef.current()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left min-h-[44px] text-text hover:bg-surface-hover"
          >
            <Copy className="w-4 h-4" />
            <span className="truncate flex-1">{t('discovery.actions.duplicate')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onExport(character)
              onCloseRef.current()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left min-h-[44px] text-text hover:bg-surface-hover"
          >
            <Download className="w-4 h-4" />
            <span className="truncate flex-1">{t('discovery.actions.export')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onDelete(character)
              onCloseRef.current()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left min-h-[44px] text-error hover:bg-surface-hover"
          >
            <Trash2 className="w-4 h-4" />
            <span className="truncate flex-1">{t('discovery.actions.delete')}</span>
          </button>
        </>
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

export default CharacterActionsMenu
