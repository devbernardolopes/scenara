import { useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useSaveConfirm } from '../../lib/saveConfirm'
import { useConfirm } from '../../lib/confirm'
import ModalShell from '../shared/ModalShell'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import { estimateTokens } from '../../services/tokenEstimator'
import { getThreadMemories, updateThreadMemory } from '../../services/threadMemories'
import { updateThread } from '../../services/threads'
import { ChevronDown, Trash2, RefreshCw, Eye } from '../../lib/icons'
import db from '../../db'
import { replaceVars } from '../../services/chatApi'

function formatTokenCount(count) {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return String(count)
}

function MemoryModal({ threadId }) {
  const { t } = useTranslation(['chat', 'common'])
  const { closeModal, setCloseGuard, openModal } = useModal()
  const { promptSave } = useSaveConfirm()
  const { confirm } = useConfirm()
  const [memories, setMemories] = useState([])
  const [drafts, setDrafts] = useState({})
  const [expandedId, setExpandedId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const loadMemories = useCallback(async () => {
    const list = await getThreadMemories(threadId)
    setMemories(list)
    if (list.length > 0) {
      setExpandedId(list[0].id)
      setDrafts({ [list[0].id]: list[0].content || '' })
    }
  }, [threadId])

  useEffect(() => {
    loadMemories()
  }, [loadMemories])

  useEffect(() => {
    function handleRegenerated(e) {
      if (e.detail?.threadId !== Number(threadId)) return
      loadMemories()
    }
    window.addEventListener('memory-regenerated', handleRegenerated)
    return () => window.removeEventListener('memory-regenerated', handleRegenerated)
  }, [threadId, loadMemories])

  const handleClose = async () => {
    if (!dirty) {
      closeModal()
      return
    }

    const action = await promptSave()
    if (action === 'save') {
      await handleSave()
      closeModal()
      return
    }
    if (action === 'discard') {
      closeModal()
    }
  }

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

  const sortedMemories = useMemo(
    () => [...memories].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [memories],
  )

  function updateDraft(id, value) {
    setDrafts((prev) => ({ ...prev, [id]: value }))
    setDirty(true)
  }

  async function handleSave() {
    if (!sortedMemories.length) return
    setSaving(true)
    try {
      const latest = sortedMemories[0]
      const value = (drafts[latest.id] ?? latest.content ?? '').trim()
      await updateThreadMemory(latest.id, { content: value })
      await updateThread(threadId, { memory: value })
      const refreshed = await getThreadMemories(threadId)
      setMemories(refreshed)
      setDrafts({ [refreshed[0]?.id]: refreshed[0]?.content || '' })
      setDirty(false)
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const latest = sortedMemories[0]
    if (!latest) return
    const ok = await confirm({
      title: t('deleteTitle'),
      message: t('messageDeleteConfirm', { number: 1 }),
      confirmLabel: t('delete'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    })
    if (!ok) return
    // delete not implemented yet
  }

  function handleRegenerate(entry) {
    if (!entry?.payload) return
    openModal('memoryRegeneration', { threadId, entry })
  }

  async function handleShowPrompt(entry) {
    if (!entry?.payload) return
    const thread = await db.threads.get(Number(threadId))
    const character = thread ? await db.characters.get(thread.characterId) : null
    const charName = character?.name || ''
    let personaName = ''
    if (thread?.personaId) {
      const persona = await db.personas.get(thread.personaId)
      personaName = persona?.name || ''
    }
    const transformedPayload = entry.payload.map((msg) => ({
      ...msg,
      content: replaceVars(msg.content || '', {
        charName,
        personaName,
        currentPersonaName: personaName,
      }),
    }))
    openModal('showPrompt', {
      payload: transformedPayload,
      model: entry.model,
      params: entry.params,
      msgNumbers: null,
    })
  }

  return (
    <ModalShell
      title={t('memories')}
      onClose={handleClose}
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            className="min-h-[44px] px-4 rounded-md text-sm text-secondary hover:text-text"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="min-h-[44px] px-4 rounded-md text-sm bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-60"
          >
            {t('save', { ns: 'common' })}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {sortedMemories.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-sm text-secondary">
            {t('promptHistory.empty')}
          </div>
        ) : (
          sortedMemories.map((entry, index) => {
            const isLatest = index === 0
            const isOpen = expandedId === entry.id
            const tokenCount = estimateTokens((drafts[entry.id] ?? entry.content) || '')
            return (
              <div key={entry.id} className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-secondary">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : entry.id)}
                    className="flex-1 flex items-center gap-2 min-h-[44px] text-left"
                  >
                    <ChevronDown
                      className={`w-4 h-4 text-tertiary transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                    <span className="text-sm font-medium text-text">
                      {t('memoryEntry', { number: sortedMemories.length - index })}
                    </span>
                    <span className="text-xs text-tertiary">
                      {t('tokens', { count: formatTokenCount(tokenCount) })}
                    </span>
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleShowPrompt(entry)}
                      className="p-2 rounded-md hover:bg-surface-hover text-tertiary"
                      title={t('showPrompt')}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {isLatest && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRegenerate(entry)}
                          className="p-2 rounded-md hover:bg-surface-hover text-tertiary"
                          title={t('regenerate')}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleDelete}
                          className="p-2 rounded-md hover:bg-surface-hover text-error"
                          title={t('delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className="px-3 pb-3 pt-1">
                    <AutoResizeTextarea
                      readOnly={!isLatest}
                      value={(drafts[entry.id] ?? entry.content) || ''}
                      onChange={(e) => updateDraft(entry.id, e.target.value)}
                      className="w-full p-3 border border-border rounded-md bg-surface text-text text-sm resize-none focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </ModalShell>
  )
}

export default MemoryModal
