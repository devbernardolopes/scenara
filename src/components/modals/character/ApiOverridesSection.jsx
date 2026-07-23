import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../../hooks/useModal'
import { getAllProfiles } from '../../../services/connectionProfiles'
import ProfilePicker from '../../shared/ProfilePicker'
import ProviderIcon from '../../shared/ProviderIcon'
import { Edit3, RefreshCw } from '../../../lib/icons'

const REQUEST_KINDS = [
  { id: 'chat', field: 'apiProfileChatId', labelKey: 'settings:api.profileAssignment.chat' },
  {
    id: 'autoTitle',
    field: 'apiProfileAutoTitleId',
    labelKey: 'settings:api.profileAssignment.autoTitle',
  },
  {
    id: 'summarization',
    field: 'apiProfileSummarizationId',
    labelKey: 'settings:api.profileAssignment.summarization',
  },
  { id: 'ooc', field: 'apiProfileOocId', labelKey: 'settings:api.profileAssignment.ooc' },
  {
    id: 'director',
    field: 'apiProfileDirectorId',
    labelKey: 'settings:api.profileAssignment.director',
  },
]

function ProfileRow({ kind, profileId, onAssign, open, onToggle, onClose }) {
  const { t } = useTranslation('settings')
  const { openModal } = useModal()
  const [profiles, setProfiles] = useState([])
  const triggerRef = useRef(null)

  useEffect(() => {
    function load() {
      getAllProfiles().then(setProfiles)
    }
    load()
    window.addEventListener('connectionProfiles-changed', load)
    return () => window.removeEventListener('connectionProfiles-changed', load)
  }, [])

  const currentProfile = profileId ? profiles.find((pr) => pr.id === profileId) : undefined

  function handleSelect(selectedId) {
    onAssign(kind.field, selectedId)
    onToggle()
  }

  function handleEdit(e) {
    e.stopPropagation()
    if (currentProfile) openModal('profileForm', { profile: currentProfile })
  }

  function handleToggle(e) {
    e.stopPropagation()
    onToggle()
  }

  return (
    <div className="relative flex items-center justify-between min-h-[44px]">
      <span className="text-sm text-text">{t(kind.labelKey.replace('settings:', ''))}</span>
      <div className="flex items-center gap-1">
        <div className="relative" ref={triggerRef}>
          <button
            type="button"
            onClick={handleToggle}
            className="min-h-[44px] px-3 text-sm border border-border rounded-md bg-surface text-text hover:bg-surface-hover flex items-center gap-2"
          >
            {currentProfile ? (
              <>
                <ProviderIcon
                  providerId={currentProfile.providerId}
                  size={18}
                  className="shrink-0"
                />
                <div className="flex flex-col items-start leading-tight">
                  <span className="truncate">{currentProfile.name}</span>
                  {currentProfile.model && (
                    <span className="text-xs text-tertiary truncate">
                      {currentProfile.model.split('/').pop()}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <span className="text-tertiary">{t('api.profileAssignment.none')}</span>
            )}
          </button>
          <ProfilePicker
            open={open}
            onClose={onClose}
            onSelect={handleSelect}
            currentId={profileId}
            triggerRef={triggerRef}
          />
        </div>
        {currentProfile && (
          <button
            type="button"
            onClick={handleEdit}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-secondary hover:text-text hover:bg-surface-hover"
            aria-label={t('api.profile.actions.edit')}
            title={t('api.profile.actions.edit')}
          >
            <Edit3 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function ApiOverridesSection({ form, onChange }) {
  const { t } = useTranslation('characterCreation')
  const [selectedKind, setSelectedKind] = useState(null)

  const hasAnyOverride = REQUEST_KINDS.some((k) => form[k.field] != null)

  function handleAssign(field, profileId) {
    onChange(field, profileId)
  }

  function handleClearAll() {
    for (const kind of REQUEST_KINDS) {
      onChange(kind.field, null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-semibold ${hasAnyOverride ? 'text-highlight' : 'text-text'}`}>
          {t('apiOverridesTitle')}
        </h3>
        <button
          type="button"
          onClick={handleClearAll}
          className="min-h-[44px] px-4 py-2 rounded-md text-sm font-medium border border-border bg-surface text-secondary hover:bg-surface-hover inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t('apiOverridesClearAll')}
        </button>
      </div>
      <p className="text-xs text-secondary">{t('apiOverridesDesc')}</p>
      {REQUEST_KINDS.map((kind) => (
        <ProfileRow
          key={kind.id}
          kind={kind}
          profileId={form[kind.field]}
          onAssign={handleAssign}
          open={selectedKind === kind.id}
          onToggle={() => setSelectedKind(selectedKind === kind.id ? null : kind.id)}
          onClose={() => setSelectedKind(null)}
        />
      ))}
    </div>
  )
}

export default ApiOverridesSection
