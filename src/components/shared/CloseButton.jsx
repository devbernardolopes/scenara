import { X } from '../../lib/icons'

function CloseButton({ onClick, label = 'Close' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
      aria-label={label}
    >
      <X className="w-5 h-5" />
    </button>
  )
}

export default CloseButton
