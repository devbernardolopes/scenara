import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import ModalShell from '../shared/ModalShell'
import { estimateTokens } from '../../services/tokenEstimator'

function formatTokenCount(count) {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return String(count)
}

function ShowPromptModal({ payload, model, params }) {
  const { t } = useTranslation('chat')
  const { closeModal } = useModal()

  const totalTokens = (payload || []).reduce(
    (sum, msg) => sum + estimateTokens(msg.content || ''),
    0,
  )

  const paramEntries = Object.entries(params || {}).filter(
    ([, v]) => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0),
  )

  return (
    <ModalShell title={t('showPrompt')} onClose={closeModal}>
      <div className="space-y-6">
        <div className="space-y-1.5 p-4 bg-surface-secondary rounded-lg text-sm">
          <div className="flex items-center gap-2 text-text">
            <span className="font-medium">{t('totalTokens')}:</span>
            <span>{formatTokenCount(totalTokens)}</span>
          </div>
          {model && (
            <div className="flex items-center gap-2 text-text">
              <span className="font-medium">{t('model')}:</span>
              <span className="text-secondary">{model}</span>
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

        <div className="space-y-4">
          {(payload || []).map((msg, idx) => {
            const tokenCount = estimateTokens(msg.content || '')
            return (
              <div key={idx}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-medium text-text">#{idx + 1}</span>
                  <span className="text-xs font-medium text-secondary">
                    {msg.role.toUpperCase()}
                  </span>
                  <span className="text-xs text-tertiary">
                    ~{formatTokenCount(tokenCount)} {t('tokens', { count: tokenCount })}
                  </span>
                </div>
                <textarea
                  readOnly
                  value={msg.content || ''}
                  className="w-full min-h-[60px] p-3 border border-border rounded-md bg-surface text-text text-sm resize-none focus:outline-none cursor-default"
                  rows={Math.max(3, Math.ceil((msg.content || '').length / 120))}
                />
              </div>
            )
          })}
        </div>
      </div>
    </ModalShell>
  )
}

export default ShowPromptModal
