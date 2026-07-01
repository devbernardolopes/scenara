function SettingInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <div className="flex items-center min-h-[44px]">
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-64 px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm"
      />
    </div>
  )
}

export default SettingInput
