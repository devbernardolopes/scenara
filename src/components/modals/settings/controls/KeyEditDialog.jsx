import { useState } from 'react'
import { useTranslation } from 'react-i18next'

function KeyEditDialog({ title, initialValue, initialLabel, onSave, onCancel }) {
  const { t } = useTranslation('settings')
  const [value, setValue] = useState(initialValue || '')
  const [label, setLabel] = useState(initialLabel || '')

  function handleSave() {
    if (!value.trim()) return
    onSave({ value: value.trim(), label: label.trim() })
  }

  return (
    <div
      className="fixed inset-0 z-80 flex items-center justify-center bg-overlay"
      onClick={onCancel}
    >
      <div
        className="bg-glass border-glass rounded-lg shadow-surface-lg max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-text mb-4">{title}</h2>

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-secondary">{t('api.keyValueLabel')}</label>
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('api.keyValuePlaceholder')}
              autoFocus
              className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-secondary">{t('api.keyLabelLabel')}</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('api.keyLabelPlaceholder')}
              className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface bg-surface-secondary text-text placeholder-tertiary text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 text-sm text-secondary hover:text-text"
          >
            {t('cancel', { ns: 'common' })}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!value.trim()}
            className="min-h-[44px] px-4 rounded-md text-sm bg-primary text-on-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('save', { ns: 'common' })}
          </button>
        </div>
      </div>
    </div>
  )
}

export default KeyEditDialog
