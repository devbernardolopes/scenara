import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../../lib/confirm'
import { useModal } from '../../../hooks/useModal'
import { showToast } from '../../../lib/toast'
import { resetDatabase, resetSettings, importDatabase } from '../../../services/database'
import { getSetting, setSetting } from '../../../services/settings'
import { jsonReviver } from '../../../lib/download'
import { Download, Upload, AlertTriangle, RefreshCw } from '../../../lib/icons'

function DatabaseSettingsPanel() {
  const { confirm } = useConfirm()
  const { openModal, updateModal } = useModal()
  const { t } = useTranslation('settings')
  const [resetting, setResetting] = useState(false)
  const [resettingSettings, setResettingSettings] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef(null)

  const [importUrl, setImportUrl] = useState('')
  const importViaUrlRef = useRef(null)

  useEffect(() => {
    getSetting('database.importUrl').then((val) => {
      if (val) setImportUrl(val)
    })
  }, [])

  function handleImportUrlChange(value) {
    setImportUrl(value)
    setSetting('database.importUrl', value)
  }

  const handleExport = () => {
    openModal('exportDatabase', { modalSize: 'lg' })
  }

  const handleImport = () => {
    openModal('importSource', {
      onFromFile: () => {
        fileInputRef.current?.click()
      },
      onFromUrl: handleImportFromUrl,
    })
  }

  async function handleImportFromUrl(url) {
    setIsImporting(true)
    openModal('progress', { status: 'importing', label: t('database.importModal.fetching') })

    try {
      const response = await fetch(url)
      if (!response.ok) {
        updateModal({
          status: 'error',
          label: t('database.importModal.fetchFailed'),
        })
        return
      }
      const text = await response.text()
      let data
      try {
        data = JSON.parse(text, jsonReviver)
      } catch {
        updateModal({
          status: 'error',
          label: t('database.importModal.invalidFormat'),
        })
        return
      }

      await importDatabase(data)
      updateModal({ status: 'imported', label: t('database.importModal.imported') })
    } catch (err) {
      updateModal({
        status: 'error',
        label: err.message || t('database.importModal.fetchFailed'),
      })
    } finally {
      setIsImporting(false)
    }
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setIsImporting(true)
    openModal('progress', { status: 'importing', label: t('database.importModal.importing') })

    try {
      const text = await file.text()
      let data
      try {
        data = JSON.parse(text, jsonReviver)
      } catch {
        updateModal({
          status: 'error',
          label: t('database.importModal.invalidFile'),
        })
        return
      }

      await importDatabase(data)
      updateModal({ status: 'imported', label: t('database.importModal.imported') })
    } catch (err) {
      updateModal({
        status: 'error',
        label: err.message || t('database.importModal.failedImport'),
      })
    } finally {
      setIsImporting(false)
    }
  }

  const handleReset = async () => {
    const confirmed = await confirm({
      title: t('database.resetConfirmTitle'),
      message: t('database.resetConfirmMessage'),
      confirmLabel: t('common:confirm'),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (!confirmed) return

    setResetting(true)
    try {
      await resetDatabase()
      showToast(t('database.resetSuccess'), { type: 'success' })
      window.location.reload()
    } catch (err) {
      showToast(err.message, { type: 'error' })
    } finally {
      setResetting(false)
    }
  }

  const handleResetSettings = async () => {
    const confirmed = await confirm({
      title: t('database.resetSettingsConfirmTitle'),
      message: t('database.resetSettingsConfirmMessage'),
      confirmLabel: t('common:confirm'),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (!confirmed) return

    setResettingSettings(true)
    try {
      await resetSettings()
      showToast(t('database.resetSettingsSuccess'), { type: 'success' })
      window.location.reload()
    } catch (err) {
      showToast(err.message, { type: 'error' })
    } finally {
      setResettingSettings(false)
    }
  }

  return (
    <div className="space-y-3">
      <OptionCard
        icon={Download}
        label={t('database.export')}
        desc={t('database.exportDesc')}
        onClick={handleExport}
      />
      <OptionCard
        icon={Upload}
        label={t('database.import')}
        desc={t('database.importDesc')}
        onClick={handleImport}
        disabled={isImporting}
      />
      <div>
        <label className="block text-sm font-medium text-text mb-2">{t('database.fromUrl')}</label>
        <div className="flex gap-2">
          <input
            ref={importViaUrlRef}
            type="url"
            value={importUrl}
            onChange={(e) => handleImportUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && importUrl.trim()) {
                handleImportFromUrl(importUrl.trim())
              }
            }}
            placeholder={t('database.fromUrlPlaceholder')}
            className="flex-1 min-h-[44px] px-3 py-2 rounded-lg border border-border bg-surface bg-surface-secondary text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => {
              if (importUrl.trim()) handleImportFromUrl(importUrl.trim())
            }}
            disabled={isImporting || !importUrl.trim()}
            className="min-h-[44px] px-4 btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {t('database.importFromUrl')}
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelected}
        className="hidden"
      />
      <OptionCard
        icon={RefreshCw}
        label={t('database.resetSettings')}
        desc={t('database.resetSettingsDesc')}
        onClick={handleResetSettings}
        disabled={resettingSettings}
        danger
      />
      <OptionCard
        icon={AlertTriangle}
        label={t('database.reset')}
        desc={t('database.resetDesc')}
        onClick={handleReset}
        disabled={resetting}
        danger
      />
    </div>
  )
}

function OptionCard({ icon: Icon, label, desc, onClick, disabled, danger }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-start gap-4 w-full min-h-[44px] p-4 rounded-lg border border-border hover:bg-surface-hover hover:border-border-light transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div
        className={`p-2 rounded-lg shrink-0 ${danger ? 'bg-error/10 text-error' : 'bg-primary-subtle text-primary'}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-text">{label}</div>
        <div className="text-xs text-secondary mt-0.5">{desc}</div>
      </div>
    </button>
  )
}

export default DatabaseSettingsPanel
