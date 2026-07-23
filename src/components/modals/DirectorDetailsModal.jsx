import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useConfirm } from '../../lib/confirm'
import { showToast } from '../../lib/toast'
import ModalShell from '../shared/ModalShell'
import CollapsibleSection from '../shared/CollapsibleSection'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import { estimateTokens } from '../../services/tokenEstimator'
import { updateMessage } from '../../services/messages'
import db from '../../db'

function DirectorDetailsModal({
  originalMessage,
  systemPrompt: initialSystemPrompt,
  userPrompt: initialUserPrompt,
  response: initialResponse,
  failed,
  messageId,
  threadId,
  outputDirectorResponse,
}) {
  const { t } = useTranslation('chat')
  const { closeModal, openModal, setCloseGuard } = useModal()
  const { confirm } = useConfirm()

  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt || '')
  const [userPrompt, setUserPrompt] = useState(initialUserPrompt || '')
  const [response, setResponse] = useState(initialResponse || '')
  const [dirty, setDirty] = useState(false)

  const textareaClass =
    'w-full p-3 border border-border rounded-md bg-surface text-text text-sm resize-none focus:outline-none'

  function checkDirty(nextSystem, nextUser, nextResponse) {
    return (
      nextSystem !== (initialSystemPrompt || '') ||
      nextUser !== (initialUserPrompt || '') ||
      nextResponse !== (initialResponse || '')
    )
  }

  const handleClose = useCallback(async () => {
    if (!dirty) {
      closeModal()
      return
    }
    const ok = await confirm({
      title: t('directorDetailsModal.discardTitle'),
      message: t('directorDetailsModal.discardMessage'),
      confirmLabel: t('directorDetailsModal.discardConfirm'),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (ok) closeModal()
  }, [dirty, closeModal, confirm, t])

  const handleCloseRef = useRef(handleClose)
  useEffect(() => {
    handleCloseRef.current = handleClose
  })

  useEffect(() => {
    if (!dirty) {
      setCloseGuard(null)
      return
    }
    setCloseGuard(() => {
      void handleCloseRef.current()
      return false
    })
    return () => setCloseGuard(null)
  }, [dirty, setCloseGuard])

  function handleSystemChange(e) {
    const val = e.target.value
    setSystemPrompt(val)
    setDirty(checkDirty(val, userPrompt, response))
  }

  function handleUserChange(e) {
    const val = e.target.value
    setUserPrompt(val)
    setDirty(checkDirty(systemPrompt, val, response))
  }

  function handleResponseChange(e) {
    const val = e.target.value
    setResponse(val)
    setDirty(checkDirty(systemPrompt, userPrompt, val))
  }

  async function handleApply() {
    try {
      const msg = await db.messages.get(messageId)
      if (!msg) return
      const pd = msg.promptData ? JSON.parse(msg.promptData) : {}
      pd.directorSystemPrompt = systemPrompt
      pd.directorUserPrompt = userPrompt
      pd.directorResponse = response
      await updateMessage(messageId, { promptData: JSON.stringify(pd) })
      window.dispatchEvent(
        new CustomEvent('director-details-updated', {
          detail: { messageId, threadId },
        }),
      )
      setDirty(false)
      showToast(t('directorDetailsModal.saved'), { type: 'success' })
    } catch {
      showToast(t('directorDetailsModal.saveError'), { type: 'error' })
    }
  }

  function handleRegenerate() {
    if (!systemPrompt?.trim() || !userPrompt?.trim()) return
    openModal('directorRegenerationResult', {
      messageId,
      threadId,
      systemContent: systemPrompt,
      userContent: userPrompt,
      outputDirectorResponse,
    })
  }

  const canRegenerate = !!systemPrompt?.trim() && !!userPrompt?.trim()

  return (
    <ModalShell title={t('directorDetailsModal.title')} onClose={handleClose}>
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
          <AutoResizeTextarea
            value={systemPrompt}
            onChange={handleSystemChange}
            className={textareaClass}
            extraHeight={8}
          />
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
          <AutoResizeTextarea
            value={userPrompt}
            onChange={handleUserChange}
            className={textareaClass}
            extraHeight={8}
          />
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
            onChange={handleResponseChange}
            className={`${textareaClass} ${failed ? 'opacity-80' : ''}`}
            extraHeight={8}
          />
        </CollapsibleSection>
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-light">
        <div />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="min-h-[44px] px-4 rounded-md text-sm text-secondary hover:text-text"
          >
            {t('common:cancel')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!dirty}
            className="min-h-[44px] px-4 text-sm btn-primary disabled:opacity-60"
          >
            {t('directorDetailsModal.apply')}
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={!canRegenerate}
            className="min-h-[44px] px-4 text-sm btn-primary disabled:opacity-60"
          >
            {t('directorDetailsModal.regenerate')}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

export default DirectorDetailsModal
