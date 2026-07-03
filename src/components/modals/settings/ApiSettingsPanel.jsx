import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PROVIDERS, getBaseUrl, setBaseUrl } from '../../../services/apiProviders'
import { getAllProfiles, migrateFromOldSettings } from '../../../services/connectionProfiles'
import { getSetting, setSetting } from '../../../services/settings'
import CollapsibleSection from '../../shared/CollapsibleSection'
import ApiKeyManager from './controls/ApiKeyManager'
import ProfilePicker from '../../shared/ProfilePicker'

const REQUEST_KINDS = [
  { id: 'chat', labelKey: 'settings:api.profileAssignment.chat' },
  { id: 'autoTitle', labelKey: 'settings:api.profileAssignment.autoTitle' },
  { id: 'summarization', labelKey: 'settings:api.profileAssignment.summarization' },
  { id: 'director', labelKey: 'settings:api.profileAssignment.director' },
]

function ProfileAssignmentRow({ kind, currentId, onAssign, open, onToggle }) {
  const { t } = useTranslation('settings')
  const [profiles, setProfiles] = useState([])
  const [currentProfileName, setCurrentProfileName] = useState('')

  useEffect(() => {
    getAllProfiles().then(setProfiles)
  }, [])

  useEffect(() => {
    if (currentId) {
      const p = profiles.find((pr) => pr.id === currentId)
      setCurrentProfileName(p ? p.name : '')
    } else {
      setCurrentProfileName('')
    }
  }, [currentId, profiles])

  function handleSelect(profileId) {
    onAssign(kind.id, profileId)
    onToggle()
  }

  return (
    <div className="relative flex items-center justify-between min-h-[44px]">
      <span className="text-sm text-text">{t(kind.labelKey.replace('settings:', ''))}</span>
      <div className="relative">
        <button
          type="button"
          onClick={onToggle}
          className="min-h-[44px] px-3 text-sm border border-border rounded-md bg-surface text-text hover:bg-surface-hover"
        >
          {currentProfileName || (
            <span className="text-tertiary">{t('api.profileAssignment.none')}</span>
          )}
        </button>
        <ProfilePicker
          open={open}
          onClose={onToggle}
          onSelect={handleSelect}
          currentId={currentId}
        />
      </div>
    </div>
  )
}

function ApiSettingsPanel() {
  const { t } = useTranslation('settings')

  const [loading, setLoading] = useState(true)
  const [baseUrls, setBaseUrls] = useState({})
  const [profileAssignments, setProfileAssignments] = useState({})
  const [useChatForAll, setUseChatForAll] = useState(true)
  const [selectedKind, setSelectedKind] = useState(null)

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

      const savedUseChatForAll = await getSetting('api.useChatForAll')
      if (savedUseChatForAll !== null && savedUseChatForAll !== undefined) {
        setUseChatForAll(savedUseChatForAll)
      } else {
        const allSame = REQUEST_KINDS.every(
          (k) => assignments[k.id] === assignments.chat || !assignments[k.id],
        )
        setUseChatForAll(allSame)
      }

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
    if (kindId === 'chat') {
      setUseChatForAll(false)
      await setSetting('api.useChatForAll', false)
    }
  }

  async function handleUseChatForAllChange(val) {
    setUseChatForAll(val)
    await setSetting('api.useChatForAll', val ? 1 : 0)
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
        <h3 className="text-sm font-semibold text-text">{t('api.profileAssignment.title')}</h3>
        <ProfileAssignmentRow
          kind={REQUEST_KINDS.find((k) => k.id === 'chat')}
          currentId={profileAssignments.chat}
          onAssign={handleAssign}
          open={selectedKind === 'chat'}
          onToggle={() => setSelectedKind(selectedKind === 'chat' ? null : 'chat')}
        />

        <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
          <input
            type="checkbox"
            checked={useChatForAll}
            onChange={(e) => handleUseChatForAllChange(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm text-text">{t('api.profileAssignment.useChatForAll')}</span>
        </label>

        {!useChatForAll &&
          REQUEST_KINDS.filter((k) => k.id !== 'chat').map((kind) => (
            <ProfileAssignmentRow
              key={kind.id}
              kind={kind}
              currentId={profileAssignments[kind.id]}
              onAssign={handleAssign}
              open={selectedKind === kind.id}
              onToggle={() => setSelectedKind(selectedKind === kind.id ? null : kind.id)}
            />
          ))}
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
