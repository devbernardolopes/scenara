import { useState, useEffect, useCallback, useRef } from 'react'
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

  const originalUserContent = entry?.payload?.[1]?.content || ''
  const originalSystemContent = entry?.payload?.[0]?.content || ''
  const [userContent, setUserContent] = useState(originalUserContent)
  const [systemContent, setSystemContent] = useState(originalSystemContent)
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

  function handleUserChange(e) {
    setUserContent(e.target.value)
    setDirty(e.target.value !== originalUserContent || systemContent !== originalSystemContent)
  }

  function handleSystemChange(e) {
    setSystemContent(e.target.value)
    setDirty(e.target.value !== originalSystemContent || userContent !== originalUserContent)
  }

  function handleRegenerate() {
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
          label={t('memoryRegeneration.systemPromptLabel')}
          storageKey="memoryRegenerationSystemPrompt"
          defaultExpanded={true}
        >
          <AutoResizeTextarea
            value={systemContent}
            onChange={handleSystemChange}
            className="w-full p-3 border border-border rounded-md bg-surface text-text text-sm resize-none focus:outline-none"
            extraHeight={8}
          />
        </CollapsibleSection>
        <CollapsibleSection
          label={t('memoryRegeneration.userPromptLabel')}
          storageKey="memoryRegenerationUserPrompt"
          defaultExpanded={true}
        >
          <AutoResizeTextarea
            value={userContent}
            onChange={handleUserChange}
            className="w-full p-3 border border-border rounded-md bg-surface text-text text-sm resize-none focus:outline-none"
            extraHeight={8}
          />
        </CollapsibleSection>
      </div>
    </ModalShell>
  )
}

export default MemoryRegenerationModal
