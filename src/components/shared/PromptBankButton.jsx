import { useState, useRef, useCallback } from 'react'
import PromptBankPicker from './PromptBankPicker'
import { Database } from '../../lib/icons'

function PromptBankButton({ onSelect }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const anchorRef = useRef(null)

  const handleSelect = useCallback(
    (content) => {
      onSelect(content)
    },
    [onSelect],
  )

  return (
    <>
      <span ref={anchorRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setPickerOpen((prev) => !prev)
          }}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] text-tertiary hover:text-primary transition-colors"
          title="Load from Prompt Bank"
        >
          <Database className="w-3.5 h-3.5" />
        </button>
      </span>
      <PromptBankPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
        anchorRef={anchorRef}
      />
    </>
  )
}

export default PromptBankButton
