import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import CloseButton from '../shared/CloseButton'
import { FileUp, GitBranch, Loader, CheckCircle, AlertTriangle } from '../../lib/icons'
import { getGistService } from '../../services/cloudServices'
import { gistCreate, gistUpdate } from '../../services/githubGist'
import { downloadJson, jsonReplacer } from '../../lib/download'

function ExportDestinationModal({ exportData }) {
  const { t } = useTranslation('settings')
  const { closeModal } = useModal()
  const [hasGistService, setHasGistService] = useState(false)
  const [phase, setPhase] = useState('select')
  const [errorLabel, setErrorLabel] = useState('')

  useEffect(() => {
    getGistService().then((svc) => setHasGistService(!!svc))
  }, [])

  function handleToFile() {
    const now = new Date()
    const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
    downloadJson(exportData, `scenara-export-${ts}.json`)
    setPhase('exported')
  }

  async function handleToGist() {
    setPhase('exporting')
    try {
      const svc = await getGistService()
      if (!svc) {
        throw new Error('No GitHub Gist service configured')
      }
      const token = svc.credentials?.token || ''
      const content = JSON.stringify(exportData, jsonReplacer, 2)
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
          <CloseButton onClick={closeModal} />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-4">
          {phase === 'exported' ? (
            <>
              <CheckCircle className="w-10 h-10 text-success" />
              <p className="text-text text-sm font-medium">
                {t('database.exportModal.gistExported')}
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
            onClick={closeModal}
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
      <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-3">
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
