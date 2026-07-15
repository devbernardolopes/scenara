import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import ModalShell from '../shared/ModalShell'
import CollapsibleSection from '../shared/CollapsibleSection'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import { estimateTokens } from '../../services/tokenEstimator'

function DirectorDetailsModal({ systemPrompt, userPrompt, response, responseData, failed }) {
  const { t } = useTranslation('chat')
  const { closeModal } = useModal()

  const textareaClass =
    'w-full p-3 border border-border rounded-md bg-surface text-text text-sm resize-none focus:outline-none'

  const responseDisplay = failed
    ? response
    : responseData != null
      ? typeof responseData === 'string'
        ? responseData
        : JSON.stringify(responseData, null, 2)
      : response

  return (
    <ModalShell title={t('directorDetailsModal.title')} onClose={closeModal}>
      <div className="space-y-3">
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
          summary={
            responseDisplay
              ? t('common:tokenCount', { count: estimateTokens(responseDisplay) })
              : null
          }
          hasContent={!!responseDisplay}
          storageKey="directorDetailsResponse"
          defaultExpanded={true}
        >
          <AutoResizeTextarea
            readOnly={failed}
            value={responseDisplay}
            className={`${textareaClass} ${failed ? 'opacity-80' : ''}`}
            extraHeight={8}
          />
        </CollapsibleSection>
      </div>
    </ModalShell>
  )
}

export default DirectorDetailsModal
