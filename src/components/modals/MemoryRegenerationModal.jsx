import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useConfirm } from '../../lib/confirm'
import ModalShell from '../shared/ModalShell'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import { estimateTokens } from '../../services/tokenEstimator'
import { getEffectiveProfileFor } from '../../services/connectionProfiles'
import { ChevronDown } from '../../lib/icons'

function formatTokenCount(count) {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return String(count)
}

function MemoryRegenerationModal({ threadId, entry }) {
  const { t } = useTranslation(['chat', 'common'])
  const { closeModal, openModal, setCloseGuard } = useModal()
  const { confirm } = useConfirm()

  const originalUserContent = entry?.payload?.[1]?.content || ''
  const originalSystemContent = entry?.payload?.[0]?.content || ''
  const [userContent, setUserContent] = useState(originalUserContent)
  const [systemContent, setSystemContent] = useState(originalSystemContent)
  const [dirty, setDirty] = useState(false)
  const [expanded, setExpanded] = useState(() => new Set([0, 1]))
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    let cancelled = false
    getEffectiveProfileFor('summarization').then((p) => {
      if (!cancelled) setProfile(p)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const systemTokens = useMemo(() => estimateTokens(systemContent || ''), [systemContent])
  const userTokens = useMemo(() => estimateTokens(userContent || ''), [userContent])
  const totalTokens = systemTokens + userTokens

  const paramEntries = useMemo(
    () =>
      Object.entries(profile?.params || {}).filter(
        ([, v]) =>
          v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0),
      ),
    [profile],
  )

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

  function toggleExpand(idx) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const canRegenerate = systemContent.trim().length > 0 && userContent.trim().length > 0

  function handleRegenerate() {
    if (!canRegenerate) return
    openModal('memoryRegenerationResult', {
      threadId,
      entry,
      systemContent,
      userContent,
    })
  }

  const sections = [
    {
      idx: 0,
      role: 'system',
      label: t('memoryRegeneration.systemPromptLabel'),
      value: systemContent,
      onChange: handleSystemChange,
      tokens: systemTokens,
    },
    {
      idx: 1,
      role: 'user',
      label: t('memoryRegeneration.userPromptLabel'),
      value: userContent,
      onChange: handleUserChange,
      tokens: userTokens,
    },
  ]

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
            disabled={!canRegenerate}
            className="min-h-[44px] px-4 rounded-md text-sm bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60"
          >
            {t('memoryRegeneration.regenerate')}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="space-y-1.5 p-4 bg-surface-secondary rounded-lg text-sm">
          <div className="flex items-center gap-2 text-text">
            <span className="font-medium">{t('totalTokens')}:</span>
            <span>{formatTokenCount(totalTokens)}</span>
          </div>
          {profile?.model && (
            <div className="flex items-center gap-2 text-text">
              <span className="font-medium">{t('model')}:</span>
              <span className="text-secondary">{profile.model}</span>
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
          {sections.map((section) => {
            const isOpen = expanded.has(section.idx)
            return (
              <div key={section.idx} className="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand(section.idx)}
                  className="w-full flex items-center gap-2 px-4 py-3 min-h-[44px] text-left hover:bg-surface-hover transition-colors"
                >
                  <span className="text-xs font-medium text-secondary shrink-0 uppercase">
                    {section.role}
                  </span>
                  <span className="text-sm font-medium text-text">{section.label}</span>
                  <span className="text-xs text-tertiary shrink-0">
                    {t('tokens', { count: formatTokenCount(section.tokens) })}
                  </span>
                  <div className="flex-1" />
                  <ChevronDown
                    className={`w-4 h-4 text-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-3">
                    <AutoResizeTextarea
                      value={section.value}
                      onChange={section.onChange}
                      className="w-full p-3 border border-border rounded-md bg-surface text-text text-sm resize-none focus:outline-none"
                      extraHeight={8}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </ModalShell>
  )
}

export default MemoryRegenerationModal
