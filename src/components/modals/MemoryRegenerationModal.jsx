import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useConfirm } from '../../lib/confirm'
import ModalShell from '../shared/ModalShell'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import CollapsibleSection from '../shared/CollapsibleSection'

function MemoryRegenerationModal({ threadId, entry }) {
  const { t } = useTranslation(['chat', 'common'])
  const { closeModal, openModal, setCloseGuard } = useModal()
  const { confirm } = useConfirm()

  const originalContent = entry?.payload?.[1]?.content || ''
  const [userContent, setUserContent] = useState(originalContent)
  const [dirty, setDirty] = useState(false)

  const handleClose = useCallback(async () => {
    if (!dirty) {
      closeModal()
      return
    }
    const ok = await confirm({
      title: t('memoryRegeneration.discardTitle'),
      message: t('memoryRegeneration.discardMessage'),
      confirmLabel: t('memoryRegeneration.discardConfirm'),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (ok) closeModal()
  }, [dirty, closeModal, confirm, t])

  useEffect(() => {
    if (!dirty) {
      setCloseGuard(null)
      return
    }
    setCloseGuard(() => {
      void handleClose()
      return false
    })
    return () => setCloseGuard(null)
  }, [dirty, handleClose, setCloseGuard])

  function handleContentChange(e) {
    setUserContent(e.target.value)
    setDirty(e.target.value !== originalContent)
  }

  function handleRegenerate() {
    const systemContent = entry?.payload?.[0]?.content || ''
    openModal('memoryRegenerationResult', {
      threadId,
      entry,
      systemContent,
      userContent,
    })
  }

  return (
    <ModalShell
      title={t('memoryRegeneration.title')}
      onClose={handleClose}
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            className="min-h-[44px] px-4 rounded-md text-sm text-secondary hover:text-text"
          >
            {t('common:cancel')}
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            className="min-h-[44px] px-4 rounded-md text-sm bg-primary text-on-primary hover:bg-primary-hover"
          >
            {t('memoryRegeneration.regenerate')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <CollapsibleSection
          label={t('memoryRegeneration.userPromptLabel')}
          storageKey="memoryRegenerationUserPrompt"
          defaultExpanded={true}
        >
          <AutoResizeTextarea
            value={userContent}
            onChange={handleContentChange}
            className="w-full p-3 border border-border rounded-md bg-surface text-text text-sm resize-none focus:outline-none"
          />
        </CollapsibleSection>
      </div>
    </ModalShell>
  )
}

export default MemoryRegenerationModal
