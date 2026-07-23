import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { usePersistedState } from '../../hooks/usePersistedState'
import CloseButton from '../shared/CloseButton'
import { FileUp, Globe, GitBranch, Eye, EyeOff } from '../../lib/icons'
import { getGistService } from '../../services/cloudServices'

const URL_REGEX = /^https?:\/\/.+/i

function ImportSourceModal({ onFromFile, onFromUrl, onFromGist }) {
  const { t } = useTranslation('settings')
  const { closeModal } = useModal()
  const [mode, setMode] = useState(null)
  const [url, setUrl] = useState('')
  const [hasGistService, setHasGistService] = useState(false)
  const [passphrase, setPassphrase] = usePersistedState('import.passphrase', '')
  const [showPassphrase, setShowPassphrase] = useState(false)

  useEffect(() => {
    getGistService().then((svc) => setHasGistService(!!svc))
  }, [])

  const pw = passphrase.trim()

  function handleFromFile() {
    onFromFile?.(pw)
    closeModal()
  }

  function handleFromUrl() {
    const trimmed = url.trim()
    if (!URL_REGEX.test(trimmed)) return
    onFromUrl?.(trimmed, pw)
    closeModal()
  }

  function handleFromGist() {
    onFromGist?.(pw)
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
        <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4">
          <div>
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
          <form onSubmit={(e) => e.preventDefault()}>
            <input
              type="text"
              name="username"
              autoComplete="username"
              className="sr-only"
              tabIndex={-1}
            />
            <label className="block text-sm font-medium text-text mb-1">
              {t('database.importModal.passphrase')}
            </label>
            <div className="relative">
              <input
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && urlValid) handleFromUrl()
                }}
                placeholder={t('database.importModal.passphrasePlaceholder')}
                className="w-full min-h-[44px] px-3 pr-10 py-2 rounded-lg border border-border bg-surface text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-secondary hover:text-text"
              >
                {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-tertiary mt-1">{t('database.importModal.passphraseDesc')}</p>
          </form>
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
      <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4">
        <form onSubmit={(e) => e.preventDefault()}>
          <input
            type="text"
            name="username"
            autoComplete="username"
            className="sr-only"
            tabIndex={-1}
          />
          <label className="block text-sm font-medium text-text mb-1">
            {t('database.importModal.passphrase')}
          </label>
          <div className="relative">
            <input
              type={showPassphrase ? 'text' : 'password'}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={t('database.importModal.passphrasePlaceholder')}
              className="w-full min-h-[44px] px-3 pr-10 py-2 rounded-lg border border-border bg-surface text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowPassphrase(!showPassphrase)}
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-secondary hover:text-text"
            >
              {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-tertiary mt-1">{t('database.importModal.passphraseDesc')}</p>
        </form>

        <div className="space-y-3">
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
              <div className="text-sm font-medium text-text">
                {t('database.importModal.fromUrl')}
              </div>
              <div className="text-xs text-secondary mt-0.5">
                {t('database.importModal.fromUrlDesc')}
              </div>
            </div>
          </button>
          {hasGistService && (
            <button
              onClick={handleFromGist}
              className="flex items-start gap-4 w-full min-h-[44px] p-4 rounded-lg border border-border hover:bg-surface-hover hover:border-border-light transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-primary-subtle text-primary shrink-0">
                <GitBranch className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-text">
                  {t('database.importModal.fromGist')}
                </div>
                <div className="text-xs text-secondary mt-0.5">
                  {t('database.importModal.fromGistDesc')}
                </div>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImportSourceModal
