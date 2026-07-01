function IconButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="size-[44px] flex items-center justify-center rounded-md text-secondary hover:text-text hover:bg-surface-hover shrink-0"
      aria-label={label}
      title={label}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}

export default IconButton
