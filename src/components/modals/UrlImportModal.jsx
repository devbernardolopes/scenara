import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { importCharacterFromUrl, parseChubUrl } from '../../services/urlImport'
import ModalShell from '../shared/ModalShell'
import SaveButton from '../shared/SaveButton'
import { Loader, AlertTriangle } from '../../lib/icons'

function UrlImportModal() {
  const { t } = useTranslation('common')
  const { closeModal, openModal } = useModal()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const isSupported = parseChubUrl(url) !== null

  async function handleImport() {
    const trimmed = url.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError('')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const data = await importCharacterFromUrl(trimmed, { signal: controller.signal })
      closeModal()
      openModal('characterCreate', { initialData: data })
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message || t('urlImport.errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell
      title={t('urlImport.title')}
      onClose={loading ? undefined : closeModal}
      footer={
        <>
          <button
            type="button"
            onClick={closeModal}
            disabled={loading}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <SaveButton
            isDirty={!!url.trim()}
            saving={loading}
            disabled={!url.trim() || !isSupported}
            onClick={handleImport}
            savingText={t('urlImport.importing')}
          >
            {t('urlImport.import')}
          </SaveButton>
        </>
      }
    >
      <div className="space-y-4">
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleImport()
            }
          }}
          placeholder={t('urlImport.placeholder')}
          disabled={loading}
          className="w-full px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm disabled:opacity-50"
        />

        {loading && (
          <div className="flex items-center gap-3 text-sm text-secondary">
            <Loader className="w-4 h-4 animate-spin shrink-0" />
            {t('urlImport.importing')}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-error">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {url.trim() && !isSupported && !loading && !error && (
          <p className="text-xs text-tertiary">{t('urlImport.errorUnsupported')}</p>
        )}
      </div>
    </ModalShell>
  )
}

export default UrlImportModal
