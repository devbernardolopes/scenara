import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { usePersistedState } from '../../hooks/usePersistedState'
import CloseButton from '../shared/CloseButton'
import { FileUp, GitBranch, Loader, CheckCircle, AlertTriangle, Eye, EyeOff } from '../../lib/icons'
import { getGistService } from '../../services/cloudServices'
import { gistCreate, gistUpdate } from '../../services/githubGist'
import { jsonReplacer } from '../../lib/download'
import { encryptTree } from '../../lib/crypto'

function ExportDestinationModal({ exportData }) {
  const { t } = useTranslation('settings')
  const { closeModal } = useModal()
  const [hasGistService, setHasGistService] = useState(false)
  const [phase, setPhase] = useState('select')
  const [errorLabel, setErrorLabel] = useState('')
  const [passphrase, setPassphrase] = usePersistedState('export.passphrase', '')
  const [showPassphrase, setShowPassphrase] = useState(false)

  useEffect(() => {
    getGistService().then((svc) => setHasGistService(!!svc))
  }, [])

  async function prepareContent() {
    if (passphrase.trim()) {
      const encrypted = await encryptTree(exportData, passphrase.trim())
      return JSON.stringify(encrypted, jsonReplacer, 2)
    }
    return JSON.stringify(exportData, jsonReplacer, 2)
  }

  async function handleToFile() {
    setPhase('exporting')
    try {
      const content = await prepareContent()
      const now = new Date()
      const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const blob = new Blob([content], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `scenara-export-${ts}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setPhase('exported')
    } catch (err) {
      setErrorLabel(err.message || 'Export failed')
      setPhase('error')
    }
  }

  function handleClose() {
    closeModal()
    closeModal()
  }

  async function handleToGist() {
    setPhase('exporting')
    try {
      const svc = await getGistService()
      if (!svc) {
        throw new Error('No GitHub Gist service configured')
      }
      const token = svc.credentials?.token || ''
      const content = await prepareContent()
      const now = new Date()
      const description = `Scenara export — ${now.toISOString().slice(0, 19)}`

      if (svc.metadata?.gistId) {
        await gistUpdate(token, svc.metadata.gistId, content, description)
      } else {
        const result = await gistCreate(token, content, description)
        const gistId = result.id
        const { updateService } = await import('../../services/cloudServices')
        await updateService(svc.id, {
          name: svc.name,
          serviceType: svc.serviceType,
          baseUrl: svc.baseUrl || null,
          credentials: { ...svc.credentials },
          metadata: { ...svc.metadata, gistId },
        })
      }
      setPhase('exported')
    } catch (err) {
      setErrorLabel(err.message || 'Gist export failed')
      setPhase('error')
    }
  }

  if (phase === 'exporting') {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <div className="flex items-center justify-between p-6 pb-4 shadow-section shrink-0">
          <h2 className="text-xl font-semibold text-text">{t('database.exportModal.title')}</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-4">
          <Loader className="w-10 h-10 text-primary animate-spin" />
          <p className="text-secondary text-sm">{t('database.exportModal.exporting')}</p>
        </div>
      </div>
    )
  }

  if (phase === 'exported' || phase === 'error') {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <div className="flex items-center justify-between p-6 pb-4 shadow-section shrink-0">
          <h2 className="text-xl font-semibold text-text">{t('database.exportModal.title')}</h2>
          <CloseButton onClick={handleClose} />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-4">
          {phase === 'exported' ? (
            <>
              <CheckCircle className="w-10 h-10 text-success" />
              <p className="text-text text-sm font-medium">
                {passphrase.trim()
                  ? t('database.exportModal.encryptedExported')
                  : t('database.exportModal.exported')}
              </p>
            </>
          ) : (
            <>
              <AlertTriangle className="w-10 h-10 text-error" />
              <p className="text-text text-sm font-medium">{errorLabel}</p>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 shadow-section shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="min-h-[44px] px-4 btn-primary text-sm"
          >
            {phase === 'error' ? t('database.importModal.close') : t('database.exportModal.close')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 shadow-section shrink-0">
        <h2 className="text-xl font-semibold text-text">
          {t('database.exportModal.destinationTitle')}
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
            {t('database.exportModal.passphrase')}
          </label>
          <div className="relative">
            <input
              type={showPassphrase ? 'text' : 'password'}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="new-password"
              placeholder={t('database.exportModal.passphrasePlaceholder')}
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
          <p className="text-xs text-tertiary mt-1">{t('database.exportModal.passphraseDesc')}</p>
        </form>

        <button
          onClick={handleToFile}
          className="flex items-start gap-4 w-full min-h-[44px] p-4 rounded-lg border border-border hover:bg-surface-hover hover:border-border-light transition-colors text-left"
        >
          <div className="p-2 rounded-lg bg-primary-subtle text-primary shrink-0">
            <FileUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-text">{t('database.exportModal.toFile')}</div>
            <div className="text-xs text-secondary mt-0.5">
              {t('database.exportModal.toFileDesc')}
            </div>
          </div>
        </button>
        <button
          onClick={handleToGist}
          disabled={!hasGistService}
          className="flex items-start gap-4 w-full min-h-[44px] p-4 rounded-lg border border-border hover:bg-surface-hover hover:border-border-light transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="p-2 rounded-lg bg-primary-subtle text-primary shrink-0">
            <GitBranch className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-text">{t('database.exportModal.toGist')}</div>
            <div className="text-xs text-secondary mt-0.5">
              {hasGistService
                ? t('database.exportModal.toGistDesc')
                : t('database.exportModal.toGistUnavailable')}
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}

export default ExportDestinationModal
