import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from '../../lib/icons'

function getPageRange(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = [1]
  const windowStart = Math.max(2, current - 2)
  const windowEnd = Math.min(total - 1, current + 2)
  if (windowStart > 2) pages.push('...')
  for (let i = windowStart; i <= windowEnd; i++) pages.push(i)
  if (windowEnd < total - 1) pages.push('...')
  pages.push(total)
  return pages
}

function Pagination({ currentPage, totalPages, onPageChange }) {
  const { t } = useTranslation('common')
  const [jumping, setJumping] = useState(false)
  const [pageInput, setPageInput] = useState('')
  if (totalPages <= 1) return null

  const baseBtn = 'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-sm'

  const commitJump = () => {
    const value = parseInt(pageInput, 10)
    if (!Number.isNaN(value)) {
      onPageChange(Math.min(Math.max(value, 1), totalPages))
    }
    setJumping(false)
    setPageInput('')
  }

  const cancelJump = () => {
    setJumping(false)
    setPageInput('')
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={`${baseBtn} hidden sm:flex text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none`}
          aria-label={t('pagination.firstPage')}
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`${baseBtn} text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none`}
          aria-label={t('pagination.previousPage')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageRange(currentPage, totalPages).map((item, i) => {
          const isNear = item !== '...' && Math.abs(item - currentPage) <= 1
          return item === '...' ? (
            <span
              key={`gap-${i}`}
              className="min-w-[44px] hidden sm:block text-center text-sm text-tertiary select-none"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className={`${baseBtn} ${isNear ? '' : 'hidden sm:flex'} ${
                item === currentPage
                  ? 'bg-primary-subtle text-primary font-medium'
                  : 'text-secondary hover:bg-surface-hover'
              }`}
              aria-label={t('pagination.page', { page: item })}
              aria-current={item === currentPage ? 'page' : undefined}
            >
              {item}
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`${baseBtn} text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none`}
          aria-label={t('pagination.nextPage')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={`${baseBtn} hidden sm:flex text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none`}
          aria-label={t('pagination.lastPage')}
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      {jumping ? (
        <input
          type="text"
          inputMode="numeric"
          autoFocus
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitJump()
            if (e.key === 'Escape') cancelJump()
          }}
          onBlur={commitJump}
          className="sm:hidden min-h-[44px] w-20 rounded-md border border-border bg-surface px-2 text-center text-sm text-text outline-none"
          aria-label={t('pagination.jumpToPage')}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setPageInput(String(currentPage))
            setJumping(true)
          }}
          className="sm:hidden min-h-[44px] px-3 flex items-center rounded-md text-sm text-secondary hover:bg-surface-hover"
          aria-label={t('pagination.jumpToPage')}
        >
          {t('pagination.pageOf', { current: currentPage, total: totalPages })}
        </button>
      )}
    </div>
  )
}

export default Pagination
