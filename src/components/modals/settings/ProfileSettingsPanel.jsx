import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../../hooks/useModal'
import { useConfirm } from '../../../lib/confirm'
import {
  getAllProfiles,
  deleteProfile,
  duplicateProfile,
} from '../../../services/connectionProfiles'
import { PROVIDERS } from '../../../services/apiProviders'
import IconButton from '../../shared/IconButton'
import { Plus, Copy, Trash2, Edit3, SlidersHorizontal } from '../../../lib/icons'

function ProfileSettingsPanel() {
  const { t } = useTranslation('settings')
  const { openModal } = useModal()
  const { confirm } = useConfirm()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = await getAllProfiles()
      setProfiles(p)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    window.addEventListener('connectionProfiles-changed', load)
    return () => window.removeEventListener('connectionProfiles-changed', load)
  }, [load])

  function startCreate() {
    openModal('profileForm')
  }

  function startEdit(profile) {
    openModal('profileForm', { profile })
  }

  async function handleDelete(profile) {
    const ok = await confirm({
      title: t('api.profile.confirmDelete.title'),
      message: t('api.profile.confirmDelete.message', { name: profile.name }),
      confirmLabel: t('api.profile.actions.delete'),
      cancelLabel: t('cancel', { ns: 'common' }),
      variant: 'danger',
    })
    if (!ok) return
    await deleteProfile(profile.id)
  }

  async function handleDuplicate(profile) {
    await duplicateProfile(profile.id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-secondary text-sm">{t('loading', { ns: 'common' })}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={startCreate}
          className="min-h-[44px] px-4 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> {t('api.profile.createProfile')}
        </button>
      </div>

      {profiles.length === 0 ? (
        <p className="text-sm text-secondary py-8 text-center">{t('api.profile.noProfiles')}</p>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => {
            const provider = PROVIDERS.find((pr) => pr.id === p.providerId)
            return (
              <div
                key={p.id}
                className="border border-border rounded-lg p-3 bg-surface transition-shadow cursor-pointer hover:shadow-surface-sm"
                onClick={() => startEdit(p)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center size-[44px] shrink-0 rounded-md bg-primary-subtle">
                    <SlidersHorizontal className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-text truncate">{p.name}</span>
                    </div>
                    <p className="text-xs text-secondary mt-0.5">
                      {provider ? t(provider.nameKey.replace('settings:', '')) : p.providerId}
                      {p.model ? ` · ${p.model}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-1 -ml-1">
                  <IconButton
                    icon={Edit3}
                    label={t('api.profile.actions.edit')}
                    onClick={() => startEdit(p)}
                  />
                  <IconButton
                    icon={Copy}
                    label={t('api.profile.actions.duplicate')}
                    onClick={() => handleDuplicate(p)}
                  />
                  <IconButton
                    icon={Trash2}
                    label={t('api.profile.actions.delete')}
                    onClick={() => handleDelete(p)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ProfileSettingsPanel
