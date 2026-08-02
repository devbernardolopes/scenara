import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../../lib/confirm'
import CollapsibleSection from '../../shared/CollapsibleSection'
import AutoResizeTextarea from '../../shared/AutoResizeTextarea'
import { estimateTokens } from '../../../services/tokenEstimator'
import { Plus, Trash2, BrainCog, Copy, X } from '../../../lib/icons'

const inputClass =
  'w-full px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm'

function countWords(text) {
  const trimmed = (text || '').trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function AddButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full sticky top-0 z-10 min-h-[44px] flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-md bg-surface text-secondary hover:text-text hover:border-border-light transition-colors"
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

  function handleDuplicate(msg) {
    const clone = {
      ...msg,
      id: crypto.randomUUID(),
    }
    onChange('exampleMessages', [...messages, clone])
  }

  function handleClear(msg, e) {
    e.stopPropagation()
    handleContentChange(msg.id, '')
  }

  return (
    <div className="space-y-4">
      <AddButton onClick={handleAdd} label={t('addExampleMessage')} />

      {messages.length === 0 ? (
        <p className="text-sm text-tertiary text-center py-8">{t('noExampleMessages')}</p>
      ) : (
        messages.map((msg, idx) => (
          <div key={msg.id} className="rounded-md shadow-surface-sm">
            <CollapsibleSection
              label={`${t('exampleMessageLabel')} #${idx + 1}`}
              storageKey={
                characterId ? `charSection.exampleMsg.${characterId}.${msg.id}` : undefined
              }
              defaultExpanded={!msg.content}
              headerExtra={
                <button
                  type="button"
                  onClick={(e) => handleDelete(msg, e)}
                  className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded-md bg-delete text-on-delete hover:bg-delete-hover transition-colors"
                  aria-label={t('deleteExampleMessage')}
                  title={t('deleteExampleMessage')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              }
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
            >
              <div className="relative mt-2">
                <AutoResizeTextarea
                  className={`${inputClass} resize-none pr-12 min-h-[128px]`}
                  value={msg.content}
                  onChange={(e) => handleContentChange(msg.id, e.target.value)}
                  placeholder={t('exampleMessagePlaceholder')}
                  extraHeight={8}
                />
                <div className="absolute top-2 right-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleClear(msg, e)}
                    disabled={!msg.content?.trim()}
                    className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md bg-surface text-secondary hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={t('clearScenario')}
                    title={t('clearScenario')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {}}
                    className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md bg-surface text-secondary hover:bg-surface-hover transition-colors"
                    aria-label={t('generateScenario')}
                    title={t('generateScenario')}
                  >
                    <BrainCog className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(msg)}
                    disabled={!msg.content?.trim()}
                    className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md bg-surface text-secondary hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={t('duplicateScenario')}
                    title={t('duplicateScenario')}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CollapsibleSection>
          </div>
        ))
      )}
    </div>
  )
}

export default ExampleMessagesSection
