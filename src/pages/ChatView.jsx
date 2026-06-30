import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useModal } from '../hooks/useModal'

function ChatView() {
  const { threadId } = useParams()
  const { t } = useTranslation('chat')
  const { openModal } = useModal()

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
        <h1 className="text-2xl font-bold text-text">{t('title', { id: threadId })}</h1>
        <p className="text-secondary">{t('placeholder')}</p>
      </div>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={t('inputPlaceholder')}
            className="flex-1 px-4 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm"
            disabled
          />
          <button
            className="px-4 py-2 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm disabled:opacity-50"
            disabled
          >
            {t('send')}
          </button>
        </div>
        <button
          onClick={() => openModal('personaEditor')}
          className="mt-2 text-xs text-tertiary hover:text-text"
        >
          {t('editPersona')}
        </button>
      </div>
    </div>
  )
}

export default ChatView
