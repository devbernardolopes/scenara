import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PROVIDERS,
  getKeys,
  addKey,
  updateKey,
  deleteKey,
  setActiveKey,
  maskKey,
} from '../../../../services/apiProviders'
import { usedByProfileCount } from '../../../../services/connectionProfiles'
import { useConfirm } from '../../../../lib/confirm'
import KeyEditDialog from './KeyEditDialog'
import { Plus, Edit3, Trash2, Check, Key } from '../../../../lib/icons'

function ApiKeyManager({ providerId }) {
  const { t } = useTranslation('settings')
  const { confirm } = useConfirm()

  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingKey, setEditingKey] = useState(null)

  useEffect(() => {
    getKeys(providerId).then((k) => {
      setKeys(k)
      setLoading(false)
    })
  }, [providerId])

  function reloadKeys() {
    return getKeys(providerId).then(setKeys)
  }

  async function handleAdd({ value, label }) {
    await addKey(providerId, { value, label })
    await reloadKeys()
    setDialogOpen(false)
    setEditingKey(null)
  }

  async function handleEdit({ value, label }) {
    if (!editingKey) return
    await updateKey(providerId, editingKey.id, { value, label })
    await reloadKeys()
    setDialogOpen(false)
    setEditingKey(null)
  }

  async function handleDelete(keyId) {
    const count = await usedByProfileCount(providerId, keyId)
    const confirmed = await confirm({
      title: t('api.deleteKeyConfirm.title'),
      message:
        count > 0
          ? t('api.deleteKeyConfirm.profileWarning', { count })
          : t('api.deleteKeyConfirm.message'),
      confirmLabel: t('api.deleteKey'),
      cancelLabel: t('cancel', { ns: 'common' }),
      variant: 'danger',
    })
    if (confirmed) {
      await deleteKey(providerId, keyId)
      await reloadKeys()
    }
  }

  async function handleSetActive(keyId) {
    await setActiveKey(providerId, keyId)
    await reloadKeys()
  }

  function openAddDialog() {
    setEditingKey(null)
    setDialogOpen(true)
  }

  function openEditDialog(key) {
    setEditingKey(key)
    setDialogOpen(true)
  }

  function handleUseTrial() {
    const provider = PROVIDERS.find((p) => p.id === providerId)
    if (!provider?.trialKey) return
    addKey(providerId, { value: provider.trialKey, label: '' }).then(() => reloadKeys())
  }

  if (loading) return null

  const hasKeys = keys.length > 0

  return (
    <div className="flex flex-col gap-2">
      {hasKeys ? (
        <div className="space-y-1.5">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-surface"
            >
              <button
                type="button"
                onClick={() => handleSetActive(key.id)}
                className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title={key.active ? t('api.activeKey') : ''}
              >
                {key.active ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <span className="w-4 h-4 rounded-full border-2 border-border" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <span className="text-sm text-text font-mono">{maskKey(key.value)}</span>
                {key.label && <span className="text-xs text-tertiary ml-2">({key.label})</span>}
              </div>

              <button
                type="button"
                onClick={() => openEditDialog(key)}
                className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-tertiary hover:text-text"
                aria-label={t('api.editKey')}
              >
                <Edit3 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleDelete(key.id)}
                className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md bg-delete text-on-delete hover:bg-delete-hover"
                aria-label={t('api.deleteKey')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-tertiary">{t('api.noKeys')}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={openAddDialog}
          className="min-h-[44px] inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Plus className="w-4 h-4" />
          {t('api.addKey')}
        </button>

        <button
          type="button"
          onClick={handleUseTrial}
          className="min-h-[44px] inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Key className="w-3 h-3" />
          {t('api.useTrialKey')}
        </button>
      </div>

      {dialogOpen && (
        <KeyEditDialog
          title={editingKey ? t('api.editKeyDialogTitle') : t('api.addKeyDialogTitle')}
          initialValue={editingKey?.value || ''}
          initialLabel={editingKey?.label || ''}
          onSave={editingKey ? handleEdit : handleAdd}
          onCancel={() => {
            setDialogOpen(false)
            setEditingKey(null)
          }}
        />
      )}
    </div>
  )
}

export default ApiKeyManager
