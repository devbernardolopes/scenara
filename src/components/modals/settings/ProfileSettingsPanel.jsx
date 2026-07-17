import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../../hooks/useModal'
import { useConfirm } from '../../../lib/confirm'
import { showToast } from '../../../lib/toast'
import { downloadJson } from '../../../lib/download'
import {
  getAllProfiles,
  deleteProfile,
  deleteProfiles,
  duplicateProfile,
  duplicateProfiles,
  updateConnectionProfileOrder,
  exportProfile,
  exportProfiles,
  importProfiles,
  REQUEST_KINDS,
} from '../../../services/connectionProfiles'
import { PROVIDERS } from '../../../services/apiProviders'
import { getSetting } from '../../../services/settings'
import IconButton from '../../shared/IconButton'
import ProviderIcon from '../../shared/ProviderIcon'
import {
  Plus,
  Copy,
  Trash2,
  Edit3,
  ChevronUp,
  ChevronDown,
  Download,
  Upload,
} from '../../../lib/icons'

function ProfileSettingsPanel() {
  const { t } = useTranslation('settings')
  const { openModal } = useModal()
  const { confirm } = useConfirm()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const importRef = useRef(null)

  const firstLoad = useRef(true)
  const load = useCallback(async () => {
    if (firstLoad.current) setLoading(true)
    try {
      const p = await getAllProfiles()
      setProfiles(p)
    } finally {
      if (firstLoad.current) {
        setLoading(false)
        firstLoad.current = false
      }
    }
  }, [])

  useEffect(() => {
    load()
    window.addEventListener('connectionProfiles-changed', load)
    return () => window.removeEventListener('connectionProfiles-changed', load)
  }, [load])

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function startCreate() {
    openModal('profileForm')
  }

  function startEdit(profile) {
    openModal('profileForm', { profile })
  }

  async function handleDelete(profile) {
    const assignedKinds = []
    for (const kind of REQUEST_KINDS) {
      const assignedId = await getSetting(`requestKind.${kind}.profileId`)
      if (assignedId === profile.id) {
        assignedKinds.push(kind)
      }
    }

    const children =
      assignedKinds.length > 0 ? (
        <div className="text-sm text-secondary mb-4">
          <p>{t('api.profile.confirmDelete.assignedTo')}</p>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            {assignedKinds.map((kind) => (
              <li key={kind}>{t(`api.${kind}Profile.label`)}</li>
            ))}
          </ul>
        </div>
      ) : null

    const ok = await confirm({
      title: t('api.profile.confirmDelete.title'),
      message: t('api.profile.confirmDelete.message', { name: profile.name }),
      confirmLabel: t('api.profile.actions.delete'),
      cancelLabel: t('cancel', { ns: 'common' }),
      variant: 'danger',
      children,
    })
    if (!ok) return
    if (selectedIds.has(profile.id)) clearSelection()
    await deleteProfile(profile.id)
  }

  async function handleDeleteSelected() {
    if (selectedIds.size >= profiles.length) return
    const ok = await confirm({
      title: t('api.profile.confirmDelete.title'),
      message: t('api.profile.confirmDelete.messageMultiple', { count: selectedIds.size }),
      confirmLabel: t('api.profile.actions.delete'),
      cancelLabel: t('cancel', { ns: 'common' }),
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteProfiles([...selectedIds])
    } catch {
      return
    }
    clearSelection()
  }

  async function handleDuplicate(profile) {
    await duplicateProfile(profile.id)
  }

  async function handleDuplicateSelected() {
    await duplicateProfiles([...selectedIds])
    clearSelection()
  }

  async function handleExportSingle(p) {
    const data = await exportProfile(p.id)
    const safe = p.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    downloadJson(data, `profile-${safe}.json`)
  }

  async function handleExportSelected() {
    const data = await exportProfiles([...selectedIds])
    downloadJson({ connectionProfiles: data }, 'connection-profiles-export.json')
    clearSelection()
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const text = await file.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        showToast(t('api.profile.import.invalidFormat'), { type: 'error' })
        return
      }
      const items = Array.isArray(data)
        ? data
        : data.connectionProfiles
          ? data.connectionProfiles
          : [data]
      const added = await importProfiles(items)
      if (added.length === 0) {
        showToast(t('api.profile.import.invalidFormat'), { type: 'error' })
      }
    } catch {
      showToast(t('api.profile.import.fileError'), { type: 'error' })
    }
  }

  async function handleMoveUp(index) {
    if (index === 0) return
    const next = profiles.map((p) => p.id)
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    await updateConnectionProfileOrder(next)
  }

  async function handleMoveDown(index) {
    if (index === profiles.length - 1) return
    const next = profiles.map((p) => p.id)
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    await updateConnectionProfileOrder(next)
  }

  const multi = selectedIds.size > 0

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
        <button
          type="button"
          onClick={() => importRef.current?.click()}
          className="min-h-[44px] px-4 border border-border rounded-md text-text hover:bg-surface-hover text-sm flex items-center gap-2"
        >
          <Upload className="w-4 h-4" /> {t('api.profile.importProfile')}
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
        />
      </div>

      {profiles.length === 0 ? (
        <p className="text-sm text-secondary py-8 text-center">{t('api.profile.noProfiles')}</p>
      ) : (
        <>
          <div className="space-y-3">
            {profiles.map((p, index) => {
              const provider = PROVIDERS.find((pr) => pr.id === p.providerId)
              const selected = selectedIds.has(p.id)
              return (
                <div
                  key={p.id}
                  className={`border rounded-lg p-3 bg-surface transition-shadow cursor-pointer hover:shadow-surface-sm ${
                    selected ? 'border-primary ring-1 ring-primary' : 'border-border'
                  }`}
                  onClick={() => startEdit(p)}
                >
                  <div className="flex items-start gap-3">
                    <label
                      className="flex items-center min-h-[44px] min-w-[44px] cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelect(p.id)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                    </label>
                    <div className="flex items-center justify-center size-[44px] shrink-0 rounded-md bg-primary-subtle">
                      <ProviderIcon providerId={p.providerId} size={24} />
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
                      icon={Download}
                      label={t('api.profile.actions.export')}
                      onClick={() => handleExportSingle(p)}
                    />
                    <IconButton
                      icon={Trash2}
                      label={t('api.profile.actions.delete')}
                      onClick={() => handleDelete(p)}
                      className="bg-delete text-on-delete hover:bg-delete-hover"
                    />
                    <div className="ml-auto flex items-center gap-1">
                      <IconButton
                        icon={ChevronUp}
                        label={t('moveUp', { ns: 'common' })}
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                      />
                      <IconButton
                        icon={ChevronDown}
                        label={t('moveDown', { ns: 'common' })}
                        onClick={() => handleMoveDown(index)}
                        disabled={index === profiles.length - 1}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {multi && (
            <div className="sticky bottom-0 flex items-center gap-2 p-3 bg-surface border border-border rounded-lg shadow-surface-md">
              <span className="text-sm text-secondary mr-2">
                {t('api.profile.batch.selected', { count: selectedIds.size })}
              </span>
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="min-h-[44px] px-3 text-sm text-on-delete bg-delete hover:bg-delete-hover rounded-md"
              >
                {t('api.profile.batch.delete', { count: selectedIds.size })}
              </button>
              <button
                type="button"
                onClick={handleDuplicateSelected}
                className="min-h-[44px] px-3 text-sm text-text hover:bg-surface-hover rounded-md"
              >
                {t('api.profile.batch.duplicate', { count: selectedIds.size })}
              </button>
              <button
                type="button"
                onClick={handleExportSelected}
                className="min-h-[44px] px-3 text-sm text-text hover:bg-surface-hover rounded-md"
              >
                {t('api.profile.batch.export', { count: selectedIds.size })}
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="min-h-[44px] px-3 text-sm text-secondary hover:text-text ml-auto"
              >
                {t('api.profile.batch.clear')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ProfileSettingsPanel
