import { useTheme } from '../../hooks/useTheme'
import { COLOR_SLOTS, getPalette } from '../../config/colorPalettes'

export default function ColorPicker({ value, onChange, theme: explicitTheme }) {
  const { theme } = useTheme()
  const currentTheme = explicitTheme || theme
  const palette = getPalette(currentTheme)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {COLOR_SLOTS.map((slot) => {
        const c = palette[slot]
        const isSelected = value === c
        return (
          <button
            key={slot}
            type="button"
            onClick={() => onChange(isSelected ? '' : c)}
            className={`w-7 h-7 rounded-full border-2 transition-all ${
              isSelected ? 'border-text scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
            aria-label={slot}
            title={slot}
          />
        )
      })}
    </div>
  )
}
