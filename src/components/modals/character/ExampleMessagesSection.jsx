import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../../lib/confirm'
import CollapsibleSection from '../../shared/CollapsibleSection'
import AutoResizeTextarea from '../../shared/AutoResizeTextarea'
import { estimateTokens } from '../../../services/tokenEstimator'
import { Plus, Trash2, Edit3 } from '../../../lib/icons'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm'

function countWords(text) {
  const trimmed = (text || '').trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

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

function ExampleMessagesSection({ form, onChange, characterId }) {
  const { t } = useTranslation('characterCreation')
  const { confirm } = useConfirm()
  const messages = form.exampleMessages || []

  function handleAdd() {
    onChange('exampleMessages', [...messages, { id: crypto.randomUUID(), content: '' }])
  }

  function handleContentChange(id, content) {
    onChange(
      'exampleMessages',
      messages.map((m) => (m.id === id ? { ...m, content } : m)),
    )
  }

  async function handleDelete(msg, e) {
    e.stopPropagation()
    const ok = await confirm({
      title: t('confirmDeleteExampleMessageTitle'),
      message: t('confirmDeleteExampleMessage'),
      confirmLabel: t('delete'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    })
    if (!ok) return
    onChange(
      'exampleMessages',
      messages.filter((m) => m.id !== msg.id),
    )
  }

  if (messages.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-tertiary text-center py-8">{t('noExampleMessages')}</p>
        <AddButton onClick={handleAdd} label={t('addExampleMessage')} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {messages.map((msg, idx) => (
        <div key={msg.id} className="border border-border rounded-md">
          <CollapsibleSection
            label={`${t('exampleMessageLabel')} #${idx + 1}`}
            summary={
              msg.content ? (
                <>
                  {t('common:tokenCount', { count: estimateTokens(msg.content) })}
                  <span className="ml-2">
                    {t('chat:words', { count: countWords(msg.content) })}
                  </span>
                </>
              ) : null
            }
            hasContent={!!msg.content}
            storageKey={characterId ? `charSection.exampleMsg.${characterId}.${msg.id}` : undefined}
            defaultExpanded={!msg.content}
          >
            <div className="relative mt-2">
              <AutoResizeTextarea
                className={`${inputClass} resize-none pr-10`}
                value={msg.content}
                onChange={(e) => handleContentChange(msg.id, e.target.value)}
                placeholder={t('exampleMessagePlaceholder')}
                extraHeight={8}
              />
              <button
                type="button"
                onClick={(e) => handleDelete(msg, e)}
                className="absolute top-2 right-2 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md bg-delete text-on-delete hover:bg-delete-hover transition-colors"
                aria-label={t('deleteExampleMessage')}
                title={t('deleteExampleMessage')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {}}
                className="absolute top-12 right-2 min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md bg-primary-subtle text-primary hover:bg-primary-hover transition-colors"
                aria-label={t('generateExampleMessage')}
                title={t('generateExampleMessage')}
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          </CollapsibleSection>
        </div>
      ))}

      <AddButton onClick={handleAdd} label={t('addExampleMessage')} />
    </div>
  )
}

export default ExampleMessagesSection
