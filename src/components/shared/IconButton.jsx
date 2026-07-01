function IconButton({ icon: Icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`size-[44px] flex items-center justify-center rounded-md shrink-0 ${disabled ? 'text-tertiary cursor-not-allowed' : 'text-secondary hover:text-text hover:bg-surface-hover'}`}
      aria-label={label}
      title={label}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}

export default IconButton
