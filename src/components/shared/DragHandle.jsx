import { GripVertical } from '../../lib/icons'

function DragHandle({ attributes, listeners, label, className = '' }) {
  return (
    <button
      type="button"
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      className={`min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text cursor-grab active:cursor-grabbing touch-none shrink-0 ${className}`}
      aria-label={label}
    >
      <GripVertical className="w-4 h-4" />
    </button>
  )
}

export default DragHandle
