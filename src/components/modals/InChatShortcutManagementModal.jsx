import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { useConfirm } from '../../lib/confirm'
import {
  getAllInChatShortcuts,
  deleteInChatShortcut,
  duplicateInChatShortcut,
} from '../../services/inChatShortcuts'
import CloseButton from '../shared/CloseButton'
import IconButton from '../shared/IconButton'
import { Plus, Edit3, Copy, Trash2 } from '../../lib/icons'

function InChatShortcutManagementModal() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const { openModal, closeModal } = useModal()
  const { confirm } = useConfirm()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAllInChatShortcuts()
      setItems(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    window.addEventListener('inChatShortcuts-changed', load)
    return () => window.removeEventListener('inChatShortcuts-changed', load)
  }, [load])

  function startCreate() {
    openModal('inChatShortcutForm')
  }

  function startEdit(item) {
    openModal('inChatShortcutForm', { inChatShortcut: item })
  }

  async function handleDelete(item) {
    const ok = await confirm({
      title: t('inChatShortcut.confirmDelete.title'),
      message: t('inChatShortcut.confirmDelete.message', { name: item.name }),
      confirmLabel: t('inChatShortcut.actions.delete'),
      cancelLabel: tc('cancel'),
      variant: 'danger',
    })
    if (!ok) return
    await deleteInChatShortcut(item.id)
  }

  async function handleDuplicate(item) {
    await duplicateInChatShortcut(item.id)
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 border-b border-border shrink-0">
        <h2 className="text-xl font-semibold text-text">{t('inChatShortcut.title')}</h2>
        <CloseButton onClick={closeModal} />
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-4">
          <button
            type="button"
            onClick={startCreate}
            className="min-h-[44px] px-4 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> {t('inChatShortcut.createShortcut')}
          </button>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-secondary text-sm">{tc('loading')}</p>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-secondary py-8 text-center">
              {t('inChatShortcut.noShortcuts')}
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="border border-border rounded-lg p-3 bg-surface cursor-pointer hover:border-border-light transition-colors"
                  onClick={() => startEdit(item)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-text">{item.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mt-1 -ml-1">
                    <IconButton
                      icon={Edit3}
                      label={t('inChatShortcut.actions.edit')}
                      onClick={() => startEdit(item)}
                    />
                    <IconButton
                      icon={Copy}
                      label={t('inChatShortcut.actions.duplicate')}
                      onClick={() => handleDuplicate(item)}
                    />
                    <IconButton
                      icon={Trash2}
                      label={t('inChatShortcut.actions.delete')}
                      onClick={() => handleDelete(item)}
                      className="bg-delete text-on-delete hover:bg-delete-hover"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default InChatShortcutManagementModal
