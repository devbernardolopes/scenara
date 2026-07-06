import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../../lib/confirm'
import CollapsibleSection from '../../shared/CollapsibleSection'
import AutoResizeTextarea from '../../shared/AutoResizeTextarea'
import { estimateTokens } from '../../../services/tokenEstimator'
import { Plus, Trash2 } from '../../../lib/icons'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

function AddButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-[44px] flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-md text-secondary hover:text-text hover:border-border-light transition-colors"
    >
      <Plus className="w-4 h-4" />
      <span className="text-sm">{label}</span>
    </button>
  )
}

function InitialMessagesSection({ form, onChange, characterId }) {
  const { t } = useTranslation('characterCreation')
  const { confirm } = useConfirm()
  const messages = form.initialMessages || []

  function handleAdd() {
    onChange('initialMessages', [...messages, { id: crypto.randomUUID(), content: '' }])
  }

  function handleContentChange(id, content) {
    onChange(
      'initialMessages',
      messages.map((m) => (m.id === id ? { ...m, content } : m)),
    )
  }

  async function handleDelete(msg, e) {
    e.stopPropagation()
    const ok = await confirm({
      title: t('confirmDeleteInitialMessageTitle'),
      message: t('confirmDeleteInitialMessage'),
      confirmLabel: t('delete'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    })
    if (!ok) return
    onChange(
      'initialMessages',
      messages.filter((m) => m.id !== msg.id),
    )
  }

  if (messages.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-tertiary text-center py-8">{t('noInitialMessages')}</p>
        <AddButton onClick={handleAdd} label={t('addInitialMessage')} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {messages.map((msg, idx) => (
        <div key={msg.id} className="border border-border rounded-md">
          <CollapsibleSection
            label={`${t('initialMessageLabel')} #${idx + 1}`}
            summary={
              msg.content ? t('common:tokenCount', { count: estimateTokens(msg.content) }) : null
            }
            hasContent={!!msg.content}
            storageKey={characterId ? `charSection.initialMsg.${characterId}.${msg.id}` : undefined}
            defaultExpanded={!msg.content}
          >
            <div className="relative mt-2">
              <AutoResizeTextarea
                className={`${inputClass} resize-none pr-10`}
                value={msg.content}
                onChange={(e) => handleContentChange(msg.id, e.target.value)}
                placeholder={t('initialMessagePlaceholder')}
              />
              <button
                type="button"
                onClick={(e) => handleDelete(msg, e)}
                className="absolute top-2 right-2 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md text-tertiary hover:text-error hover:bg-surface-hover transition-colors"
                aria-label={t('deleteInitialMessage')}
                title={t('deleteInitialMessage')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </CollapsibleSection>
        </div>
      ))}

      <AddButton onClick={handleAdd} label={t('addInitialMessage')} />
    </div>
  )
}

export default InitialMessagesSection
