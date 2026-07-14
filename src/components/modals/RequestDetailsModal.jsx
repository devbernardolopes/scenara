import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import ModalShell from '../shared/ModalShell'
import CollapsibleSection from '../shared/CollapsibleSection'

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

function RequestDetailsModal({ payload, responseContent }) {
  const { t } = useTranslation('chat')
  const { closeModal } = useModal()
  const [openKey, setOpenKey] = useState('request')

  const requestText = formatForDisplay(payload)
  const responseText = formatForDisplay(responseContent)

  const codeClass =
    'w-full p-3 border border-border rounded-md bg-surface text-text text-xs font-mono resize-none focus:outline-none cursor-default whitespace-pre-wrap break-words'

  return (
    <ModalShell title={t('requestDetailsModal.title')} onClose={closeModal}>
      <div className="space-y-3">
        <CollapsibleSection
          label={t('requestDetailsModal.request')}
          storageKey="requestDetailsRequest"
          open={openKey === 'request'}
          onOpenChange={(next) => setOpenKey(next ? 'request' : null)}
        >
          <textarea
            readOnly
            value={requestText}
            className={`${codeClass} max-h-[60vh] overflow-auto`}
          />
        </CollapsibleSection>
        <CollapsibleSection
          label={t('requestDetailsModal.response')}
          storageKey="requestDetailsResponse"
          open={openKey === 'response'}
          onOpenChange={(next) => setOpenKey(next ? 'response' : null)}
        >
          <textarea
            readOnly
            value={responseText}
            className={`${codeClass} max-h-[60vh] overflow-auto`}
          />
        </CollapsibleSection>
      </div>
    </ModalShell>
  )
}

export default RequestDetailsModal
