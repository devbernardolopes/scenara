function SaveButton({ isDirty = true, saving, disabled, onClick, savingText, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving || disabled || !isDirty}
      className="min-h-[44px] px-6 btn-primary text-sm disabled:opacity-50"
    >
      {saving ? savingText : children}
    </button>
  )
}

export default SaveButton
