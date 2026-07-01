function SettingSlider({ value, onChange, min = 0, max = 100, step = 1 }) {
  return (
    <div className="flex items-center gap-3 min-h-[44px]">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32 accent-primary"
      />
      <span className="text-sm text-text font-medium w-12 text-right">{value}</span>
    </div>
  )
}

export default SettingSlider
