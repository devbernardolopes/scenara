import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import ModalShell from '../shared/ModalShell'
import CollapsibleSection from '../shared/CollapsibleSection'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import { estimateTokens } from '../../services/tokenEstimator'

function DirectorDetailsModal({ originalMessage, systemPrompt, userPrompt, response, failed }) {
  const { t } = useTranslation('chat')
  const { closeModal } = useModal()

  const textareaClass =
    'w-full p-3 border border-border rounded-md bg-surface text-text text-sm resize-none focus:outline-none'

  return (
    <ModalShell title={t('directorDetailsModal.title')} onClose={closeModal}>
      <div className="space-y-3">
        <CollapsibleSection
          label={t('directorDetailsModal.originalMessage')}
          summary={
            originalMessage
              ? t('common:tokenCount', { count: estimateTokens(originalMessage) })
              : null
          }
          hasContent={!!originalMessage}
          storageKey="directorDetailsOriginalMessage"
          defaultExpanded={true}
        >
          <AutoResizeTextarea
            readOnly
            value={originalMessage}
            className={textareaClass}
            extraHeight={8}
          />
        </CollapsibleSection>
        <CollapsibleSection
          label={t('directorDetailsModal.systemPrompt')}
          summary={
            systemPrompt ? t('common:tokenCount', { count: estimateTokens(systemPrompt) }) : null
          }
          hasContent={!!systemPrompt}
          storageKey="directorDetailsSystemPrompt"
          defaultExpanded={true}
        >
          <AutoResizeTextarea value={systemPrompt} className={textareaClass} extraHeight={8} />
        </CollapsibleSection>
        <CollapsibleSection
          label={t('directorDetailsModal.userPrompt')}
          summary={
            userPrompt ? t('common:tokenCount', { count: estimateTokens(userPrompt) }) : null
          }
          hasContent={!!userPrompt}
          storageKey="directorDetailsUserPrompt"
          defaultExpanded={true}
        >
          <AutoResizeTextarea value={userPrompt} className={textareaClass} extraHeight={8} />
        </CollapsibleSection>
        <CollapsibleSection
          label={
            failed ? t('directorDetailsModal.responseError') : t('directorDetailsModal.response')
          }
          summary={response ? t('common:tokenCount', { count: estimateTokens(response) }) : null}
          hasContent={!!response}
          storageKey="directorDetailsResponse"
          defaultExpanded={true}
        >
          <AutoResizeTextarea
            readOnly={failed}
            value={response}
            className={`${textareaClass} ${failed ? 'opacity-80' : ''}`}
            extraHeight={8}
          />
        </CollapsibleSection>
      </div>
    </ModalShell>
  )
}

export default DirectorDetailsModal
