import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import ModalShell from '../shared/ModalShell'
import CollapsibleSection from '../shared/CollapsibleSection'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import { estimateTokens } from '../../services/tokenEstimator'

function formatTokenCount(count) {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return String(count)
}

function ShowStatusBlockPromptModal({ systemPrompt, userPrompt, model, params, modalTitle }) {
  const { t } = useTranslation('chat')
  const { closeModal } = useModal()

  const systemTokens = estimateTokens(systemPrompt || '')
  const userTokens = estimateTokens(userPrompt || '')

  const paramEntries = Object.entries(params || {}).filter(
    ([, v]) => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0),
  )

  return (
    <ModalShell title={modalTitle || t('statusBlockDirectorPrompt')} onClose={closeModal}>
      <div className="space-y-6">
        <div className="space-y-1.5 p-4 bg-surface-secondary rounded-lg text-sm">
          <div className="flex items-center gap-2 text-text">
            <span className="font-medium">{t('totalTokens')}:</span>
            <span>{formatTokenCount(systemTokens + userTokens)}</span>
          </div>
          {model && (
            <div className="flex items-center gap-2 text-text min-w-0">
              <span className="font-medium">{t('model')}:</span>
              <span className="text-secondary break-all">{model}</span>
            </div>
          )}
          {paramEntries.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-medium text-text shrink-0">{t('parameters')}:</span>
              {paramEntries.map(([key, value]) => (
                <span key={key} className="text-secondary text-xs">
                  {key}={Array.isArray(value) ? `[${value.join(', ')}]` : String(value)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <CollapsibleSection
            label="SYSTEM"
            summary={`${formatTokenCount(systemTokens)} tokens`}
            hasContent={(systemPrompt || '').trim().length > 0}
            storageKey="showStatusBlockPromptSystem"
            defaultExpanded={true}
          >
            <AutoResizeTextarea
              readOnly
              value={systemPrompt || ''}
              className="w-full p-3 border border-border rounded-md bg-surface bg-surface-secondary text-text text-sm resize-none focus:outline-none cursor-default"
              extraHeight={8}
            />
          </CollapsibleSection>

          <CollapsibleSection
            label="USER"
            summary={`${formatTokenCount(userTokens)} tokens`}
            hasContent={(userPrompt || '').trim().length > 0}
            storageKey="showStatusBlockPromptUser"
            defaultExpanded={true}
          >
            <AutoResizeTextarea
              readOnly
              value={userPrompt || ''}
              className="w-full p-3 border border-border rounded-md bg-surface bg-surface-secondary text-text text-sm resize-none focus:outline-none cursor-default"
              extraHeight={8}
            />
          </CollapsibleSection>
        </div>
      </div>
    </ModalShell>
  )
}

export default ShowStatusBlockPromptModal
