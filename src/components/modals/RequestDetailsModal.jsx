import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import ModalShell from '../shared/ModalShell'
import CollapsibleSection from '../shared/CollapsibleSection'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'

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
      <div className="space-y-3">
        <div className="rounded-lg overflow-hidden shadow-surface-sm">
          <CollapsibleSection
            label={t('requestDetailsModal.request')}
            storageKey="requestDetailsRequest"
            defaultExpanded={true}
          >
            <AutoResizeTextarea
              readOnly
              value={requestText}
              className={textareaClass}
              extraHeight={8}
            />
          </CollapsibleSection>
        </div>
        <div className="rounded-lg overflow-hidden shadow-surface-sm">
          <CollapsibleSection
            label={t('requestDetailsModal.response')}
            storageKey="requestDetailsResponse"
            defaultExpanded={true}
          >
            <AutoResizeTextarea
              readOnly
              value={responseText}
              className={textareaClass}
              extraHeight={8}
            />
          </CollapsibleSection>
        </div>
      </div>
    </ModalShell>
  )
}

export default RequestDetailsModal
