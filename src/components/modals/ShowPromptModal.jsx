import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import ModalShell from '../shared/ModalShell'
import AutoResizeTextarea from '../shared/AutoResizeTextarea'
import { estimateTokens } from '../../services/tokenEstimator'
import { ChevronDown } from '../../lib/icons'

function formatTokenCount(count) {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return String(count)
}

function ShowPromptModal({ payload, model, params }) {
  const { t } = useTranslation('chat')
  const { closeModal } = useModal()
  const [expandedIdx, setExpandedIdx] = useState(null)

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

        <div className="space-y-2">
          {(payload || []).map((msg, idx) => {
            const tokenCount = estimateTokens(msg.content || '')
            const isOpen = expandedIdx === idx
            return (
              <div key={idx} className="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedIdx(isOpen ? null : idx)}
                  className="w-full flex items-center gap-2 px-4 py-3 min-h-[44px] text-left hover:bg-surface-hover transition-colors"
                >
                  <span className="text-xs font-medium text-text shrink-0">#{idx + 1}</span>
                  <span className="text-xs font-medium text-secondary shrink-0 uppercase">
                    {msg.role}
                  </span>
                  <span className="text-xs text-tertiary shrink-0">
                    {t('tokens', { count: formatTokenCount(tokenCount) })}
                  </span>
                  <div className="flex-1" />
                  <ChevronDown
                    className={`w-4 h-4 text-tertiary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-3">
                    <AutoResizeTextarea
                      readOnly
                      value={msg.content || ''}
                      className="w-full p-3 border border-border rounded-md bg-surface text-text text-sm resize-none focus:outline-none cursor-default"
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

export default ShowPromptModal
