import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../../hooks/useModal'
import { PROVIDERS, getBaseUrl, setBaseUrl } from '../../../services/apiProviders'
import { getAllProfiles, migrateFromOldSettings } from '../../../services/connectionProfiles'
import { getSetting, setSetting } from '../../../services/settings'
import CollapsibleSection from '../../shared/CollapsibleSection'
import ApiKeyManager from './controls/ApiKeyManager'
import SettingSlider from './controls/SettingSlider'
import ProfilePicker from '../../shared/ProfilePicker'
import ProviderIcon from '../../shared/ProviderIcon'
import { Edit3 } from '../../../lib/icons'

// UI labels for profile assignment rows (distinct from connectionProfiles.REQUEST_KINDS
// which is a string array used for DB lookups).
const REQUEST_KINDS = [
  { id: 'chat', labelKey: 'settings:api.profileAssignment.chat' },
  { id: 'autoTitle', labelKey: 'settings:api.profileAssignment.autoTitle' },
  { id: 'summarization', labelKey: 'settings:api.profileAssignment.summarization' },
  { id: 'ooc', labelKey: 'settings:api.profileAssignment.ooc' },
  { id: 'director', labelKey: 'settings:api.profileAssignment.director' },
  { id: 'interface', labelKey: 'settings:api.profileAssignment.interface' },
]

function ProfileAssignmentRow({ kind, currentId, onAssign, open, onToggle, onClose }) {
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

  const currentProfile = currentId ? profiles.find((pr) => pr.id === currentId) : undefined

  function handleSelect(profileId) {
    onAssign(kind.id, profileId)
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
            currentId={currentId}
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

function ApiSettingsPanel() {
  const { t } = useTranslation('settings')

  const [loading, setLoading] = useState(true)
  const [baseUrls, setBaseUrls] = useState({})
  const [profileAssignments, setProfileAssignments] = useState({})
  const [selectedKind, setSelectedKind] = useState(null)
  const [cooldown, setCooldown] = useState(2)
  const [requestTimeout, setRequestTimeout] = useState(150)

  useEffect(() => {
    async function load() {
      await migrateFromOldSettings()

      const urls = {}
      for (const p of PROVIDERS) {
        if (p.needsUrl) {
          urls[p.id] = await getBaseUrl(p.id)
        }
      }
      setBaseUrls(urls)

      const assignments = {}
      for (const kind of REQUEST_KINDS) {
        assignments[kind.id] = await getSetting(`requestKind.${kind.id}.profileId`)
      }
      setProfileAssignments(assignments)

      setCooldown(await getSetting('api.requestCooldown'))
      setRequestTimeout(await getSetting('api.requestTimeout'))

      setLoading(false)
    }
    load()
  }, [])

  async function handleBaseUrlChange(providerId, value) {
    setBaseUrls((prev) => ({ ...prev, [providerId]: value }))
    await setBaseUrl(providerId, value)
  }

  async function handleAssign(kindId, profileId) {
    setProfileAssignments((prev) => ({ ...prev, [kindId]: profileId }))
    await setSetting(`requestKind.${kindId}.profileId`, profileId)
  }

  async function handleClearAll() {
    const assignments = {}
    for (const kind of REQUEST_KINDS) {
      assignments[kind.id] = null
      await setSetting(`requestKind.${kind.id}.profileId`, null)
    }
    setProfileAssignments(assignments)
  }

  async function handleCooldownChange(val) {
    setCooldown(val)
    await setSetting('api.requestCooldown', val)
  }

  async function handleTimeoutChange(val) {
    setRequestTimeout(val)
    await setSetting('api.requestTimeout', val)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-tertiary">{t('loading', { ns: 'common' })}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-text">{t('api.profileAssignment.title')}</h3>
          <button
            type="button"
            onClick={handleClearAll}
            className="min-h-[44px] px-3 text-sm border border-border rounded-md text-text hover:bg-surface-hover whitespace-nowrap"
          >
            {t('api.profileAssignment.clearAll')}
          </button>
        </div>
        {REQUEST_KINDS.map((kind) => (
          <ProfileAssignmentRow
            key={kind.id}
            kind={kind}
            currentId={profileAssignments[kind.id]}
            onAssign={handleAssign}
            open={selectedKind === kind.id}
            onToggle={() => setSelectedKind(selectedKind === kind.id ? null : kind.id)}
            onClose={() => setSelectedKind(null)}
          />
        ))}
      </div>

      <div className="border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text">{t('api.requestCooldown.label')}</h3>
            <p className="text-xs text-secondary mt-0.5">{t('api.requestCooldown.desc')}</p>
          </div>
          <SettingSlider
            value={cooldown}
            onChange={handleCooldownChange}
            min={2}
            max={10}
            step={0.5}
          />
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text">{t('api.requestTimeout.label')}</h3>
            <p className="text-xs text-secondary mt-0.5">{t('api.requestTimeout.desc')}</p>
          </div>
          <SettingSlider
            value={requestTimeout}
            onChange={handleTimeoutChange}
            min={30}
            max={300}
            step={30}
          />
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-text mb-4">
          {t('api.profileAssignment.apiKeys')}
        </h3>
        {PROVIDERS.map((provider) => (
          <CollapsibleSection
            key={provider.id}
            label={t(provider.nameKey.replace('settings:', ''))}
            summary={t(provider.descKey.replace('settings:', ''))}
            hasContent={false}
            storageKey={`apiSection.${provider.id}`}
          >
            <div className="space-y-4 pt-2">
              {provider.needsKey && <ApiKeyManager providerId={provider.id} />}

              {provider.needsUrl && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-secondary">
                    {t('api.serverUrl.label')}
                  </label>
                  <input
                    type="url"
                    value={baseUrls[provider.id] || ''}
                    onChange={(e) => handleBaseUrlChange(provider.id, e.target.value)}
                    placeholder={t('api.serverUrl.placeholder')}
                    className="w-full min-h-[44px] px-3 py-2 border border-border rounded-md bg-surface text-text placeholder-tertiary text-sm"
                  />
                </div>
              )}
            </div>
          </CollapsibleSection>
        ))}
      </div>
    </div>
  )
}

export default ApiSettingsPanel
