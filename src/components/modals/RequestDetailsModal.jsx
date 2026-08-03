import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import ModalShell from '../shared/ModalShell'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import { getUIState, setUIState } from '../../services/uiState'
import { ChevronDown } from '../../lib/icons'

function formatForDisplay(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2)
      } catch {
        return value
      }
    }
    return value
  }
  if (value !== null && typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value ?? '')
}

function RequestSection({ label, storageKey, defaultExpanded = true, value, textareaClass }) {
  const [open, setOpen] = useState(defaultExpanded)

  useEffect(() => {
    if (!storageKey) return
    getUIState(`collapsed.${storageKey}`).then((val) => {
      if (val !== null) setOpen(!val)
    })
  }, [storageKey])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (storageKey) setUIState(`collapsed.${storageKey}`, !next)
  }

  return (
    <div className="rounded-lg overflow-hidden shadow-surface-sm">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-2 px-4 py-3 min-h-[44px] text-left hover:bg-surface-hover transition-colors"
      >
        <span className="text-sm font-medium text-text">{label}</span>
        <div className="flex-1" />
        <ChevronDown
          className={`w-4 h-4 text-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-3">
          <AutoResizeTextarea readOnly value={value} className={textareaClass} extraHeight={8} />
        </div>
      )}
    </div>
  )
}

function RequestDetailsModal({ payload, responseData, responseContent }) {
  const { t } = useTranslation('chat')
  const { closeModal } = useModal()

  const requestText = formatForDisplay(payload)
  const responseText =
    responseData != null ? formatForDisplay(responseData) : formatForDisplay(responseContent)

  const textareaClass =
    'w-full p-3 border border-border rounded-md bg-surface bg-surface-secondary text-text text-sm resize-none focus:outline-none cursor-default'

  return (
    <ModalShell title={t('requestDetailsModal.title')} onClose={closeModal}>
      <div className="space-y-2">
        <RequestSection
          label={t('requestDetailsModal.request')}
          storageKey="requestDetailsRequest"
          defaultExpanded={true}
          value={requestText}
          textareaClass={textareaClass}
        />
        <RequestSection
          label={t('requestDetailsModal.response')}
          storageKey="requestDetailsResponse"
          defaultExpanded={true}
          value={responseText}
          textareaClass={textareaClass}
        />
      </div>
    </ModalShell>
  )
}

export default RequestDetailsModal
