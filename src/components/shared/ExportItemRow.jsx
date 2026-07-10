import Avatar from './Avatar'

function ExportItemRow({ checked, onChange, avatar, title, id, idLabel }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-md bg-surface-secondary">
      <label
        className="flex items-center min-h-[44px] min-w-[44px] cursor-pointer -ml-1"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
        />
      </label>
      {avatar !== undefined && (
        <div className="shrink-0">
          {avatar ? (
            <Avatar src={avatar} size="md" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-subtle flex items-center justify-center">
              <span className="text-xs text-primary font-medium">—</span>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-sm font-medium text-text truncate">{title}</span>
        {id !== undefined && (
          <span className="text-xs text-tertiary shrink-0">{idLabel || `#${id}`}</span>
        )}
      </div>
    </div>
  )
}

export default ExportItemRow
