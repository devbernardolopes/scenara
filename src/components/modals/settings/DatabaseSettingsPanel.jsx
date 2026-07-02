import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfirm } from '../../../lib/confirm'
import { showToast } from '../../../lib/toast'
import { resetDatabase } from '../../../services/database'
import { Download, Upload, AlertTriangle } from '../../../lib/icons'

function DatabaseSettingsPanel() {
  const { confirm } = useConfirm()
  const { t } = useTranslation('settings')
  const [resetting, setResetting] = useState(false)

  const handleExport = () => {
    showToast(t('database.exportNotImplemented'), { type: 'info' })
  }

  const handleImport = () => {
    showToast(t('database.importNotImplemented'), { type: 'info' })
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
    } catch (err) {
      showToast(err.message, { type: 'error' })
    } finally {
      setResetting(false)
    }
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

export default DatabaseSettingsPanel
