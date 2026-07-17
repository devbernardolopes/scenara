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

function Row({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className="flex gap-2 text-sm py-1">
      <span className="text-secondary shrink-0 w-32">{label}</span>
      <span className="text-text break-all">{value}</span>
    </div>
  )
}

function LogDetailsModal({ log }) {
  const { t } = useTranslation(['common', 'logs'])
  const { closeModal } = useModal()

  const textareaClass =
    'w-full p-3 border border-border rounded-md bg-surface text-text text-sm resize-none focus:outline-none'

  const isApi = log?.type === 'api'

  return (
    <ModalShell title={t('logs:detailsTitle')} onClose={closeModal}>
      <div className="space-y-3">
        {log && (
          <div className="rounded-md border border-border p-3 bg-surface">
            <Row label={t('logs:fieldType')} value={log.type} />
            <Row label={t('logs:fieldLevel')} value={log.level} />
            <Row
              label={t('logs:fieldTime')}
              value={log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}
            />
            <Row label={t('logs:fieldThread')} value={log.threadId ?? ''} />
            {isApi && (
              <>
                <Row label={t('logs:fieldKind')} value={log.kind ?? ''} />
                <Row label={t('logs:fieldProvider')} value={log.providerId ?? ''} />
                <Row label={t('logs:fieldModel')} value={log.model ?? ''} />
                <Row
                  label={t('logs:fieldDuration')}
                  value={log.durationMs != null ? `${log.durationMs}ms` : ''}
                />
                <Row label={t('logs:fieldStatus')} value={log.status ?? ''} />
              </>
            )}
            {log.message != null && <Row label={t('logs:fieldMessage')} value={log.message} />}
            {log.error != null && <Row label={t('logs:fieldError')} value={log.error} />}
          </div>
        )}

        {isApi && (
          <>
            <CollapsibleSection
              label={t('logs:request')}
              storageKey="logDetailsRequest"
              defaultExpanded={true}
            >
              <AutoResizeTextarea
                readOnly
                value={formatForDisplay(log.request)}
                className={textareaClass}
                extraHeight={8}
              />
            </CollapsibleSection>
            <CollapsibleSection
              label={t('logs:response')}
              storageKey="logDetailsResponse"
              defaultExpanded={true}
            >
              <AutoResizeTextarea
                readOnly
                value={formatForDisplay(log.response)}
                className={textareaClass}
                extraHeight={8}
              />
            </CollapsibleSection>
          </>
        )}
      </div>
    </ModalShell>
  )
}

export default LogDetailsModal
