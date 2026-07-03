function IconButton({ icon: Icon, label, onClick, disabled, className = '' }) {
  return (
    <button
      type="button"
      onClick={
        disabled
          ? undefined
          : (e) => {
              e.stopPropagation()
              onClick(e)
            }
      }
      disabled={disabled}
      className={`size-[44px] flex items-center justify-center rounded-md shrink-0 ${disabled ? 'text-tertiary cursor-not-allowed' : 'text-secondary hover:text-text hover:bg-surface-hover'} ${className}`}
      aria-label={label}
      title={label}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}

export default IconButton
