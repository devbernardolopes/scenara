import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useConfirm } from '../../lib/confirm'
import { showToast } from '../../lib/toast'
import { resetDatabase } from '../../services/database'
import { Download, Upload, AlertTriangle } from '../../lib/icons'
import CloseButton from '../shared/CloseButton'

function DatabaseModal() {
  const { closeModal } = useModal()
  const { confirm } = useConfirm()
  const { t } = useTranslation('common')
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
      confirmLabel: t('confirm'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    })
    if (!confirmed) return

    setResetting(true)
    try {
      await resetDatabase()
      showToast(t('database.resetSuccess'), { type: 'success' })
      closeModal()
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
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 border-b border-border shrink-0">
        <h2 className="text-xl font-semibold text-text">{t('database.title')}</h2>
        <CloseButton onClick={closeModal} />
      </div>
      <div className="flex-1 flex flex-col gap-3 p-6 overflow-y-auto justify-center">
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
    </div>
  )
}

export default DatabaseModal
