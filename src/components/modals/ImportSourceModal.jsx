import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import CloseButton from '../shared/CloseButton'
import { FileUp, Globe } from '../../lib/icons'

const URL_REGEX = /^https?:\/\/.+/i

function ImportSourceModal({ onFromFile, onFromUrl }) {
  const { t } = useTranslation('settings')
  const { closeModal } = useModal()
  const [mode, setMode] = useState(null)
  const [url, setUrl] = useState('')

  function handleFromFile() {
    onFromFile?.()
    closeModal()
  }

  function handleFromUrl() {
    const trimmed = url.trim()
    if (!URL_REGEX.test(trimmed)) return
    onFromUrl?.(trimmed)
    closeModal()
  }

  const urlValid = URL_REGEX.test(url.trim())

  if (mode === 'url') {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <div className="flex items-center justify-between p-6 pb-4 shadow-section shrink-0">
          <h2 className="text-xl font-semibold text-text">
            {t('database.importModal.importSourceTitle')}
          </h2>
          <CloseButton onClick={closeModal} />
        </div>
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <label className="block text-sm font-medium text-text mb-2">
            {t('database.importModal.urlLabel')}
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && urlValid) handleFromUrl()
            }}
            placeholder={t('database.importModal.urlPlaceholder')}
            className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            autoFocus
          />
          {url && !urlValid && (
            <p className="text-xs text-error mt-1.5">{t('database.importModal.urlInvalid')}</p>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 shadow-section shrink-0">
          <button
            type="button"
            onClick={() => {
              setMode(null)
              setUrl('')
            }}
            className="min-h-[44px] px-4 rounded-md border border-border text-text hover:bg-surface-hover text-sm"
          >
            {t('common:back')}
          </button>
          <button
            type="button"
            onClick={handleFromUrl}
            disabled={!urlValid}
            className="min-h-[44px] px-4 btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('database.importFromUrl')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 shadow-section shrink-0">
        <h2 className="text-xl font-semibold text-text">
          {t('database.importModal.importSourceTitle')}
        </h2>
        <CloseButton onClick={closeModal} />
      </div>
      <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-3">
        <button
          onClick={handleFromFile}
          className="flex items-start gap-4 w-full min-h-[44px] p-4 rounded-lg border border-border hover:bg-surface-hover hover:border-border-light transition-colors text-left"
        >
          <div className="p-2 rounded-lg bg-primary-subtle text-primary shrink-0">
            <FileUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-text">
              {t('database.importModal.fromFile')}
            </div>
            <div className="text-xs text-secondary mt-0.5">
              {t('database.importModal.fromFileDesc')}
            </div>
          </div>
        </button>
        <button
          onClick={() => setMode('url')}
          className="flex items-start gap-4 w-full min-h-[44px] p-4 rounded-lg border border-border hover:bg-surface-hover hover:border-border-light transition-colors text-left"
        >
          <div className="p-2 rounded-lg bg-primary-subtle text-primary shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-text">{t('database.importModal.fromUrl')}</div>
            <div className="text-xs text-secondary mt-0.5">
              {t('database.importModal.fromUrlDesc')}
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}

export default ImportSourceModal
