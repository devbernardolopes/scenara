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
  if (totalPages <= 1) return null

  const baseBtn =
    'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-sm'

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        className={`${baseBtn} text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none`}
        aria-label="First page"
      >
        <ChevronsLeft className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`${baseBtn} text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none`}
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {getPageRange(currentPage, totalPages).map((item, i) =>
        item === '...' ? (
          <span key={`gap-${i}`} className="min-w-[44px] text-center text-sm text-tertiary select-none">
            …
        </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            className={`${baseBtn} ${
              item === currentPage
                ? 'bg-primary-subtle text-primary font-medium'
                : 'text-secondary hover:bg-surface-hover'
            }`}
            aria-label={`Page ${item}`}
            aria-current={item === currentPage ? 'page' : undefined}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`${baseBtn} text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none`}
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        className={`${baseBtn} text-secondary hover:bg-surface-hover disabled:opacity-40 disabled:pointer-events-none`}
        aria-label="Last page"
      >
        <ChevronsRight className="w-4 h-4" />
      </button>
    </div>
  )
}

export default Pagination
