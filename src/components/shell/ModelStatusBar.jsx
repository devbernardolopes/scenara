import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { getSetting } from '../../services/settings'
import {
  getEffectiveProfileFor,
  getEffectiveTopP,
  getEffectiveTemperature,
  getProfile,
} from '../../services/connectionProfiles'
import { useHordeEta } from '../../hooks/useHordeEta'
import MarqueeText from '../shared/MarqueeText'

export default function ModelStatusBar({ embedded = false }) {
  const { t } = useTranslation('chat')
  const { openModal } = useModal()
  const [show, setShow] = useState(true)
  const [modelName, setModelName] = useState('')
  const [topP, setTopP] = useState(null)
  const [temperature, setTemperature] = useState(null)
  const [profile, setProfile] = useState(null)
  const [statusEnabled, setStatusEnabled] = useState(false)
  const [statusBarRefresh, setStatusBarRefresh] = useState(30)

  const hordeEta = useHordeEta(statusEnabled, 'chat', statusBarRefresh)

  useEffect(() => {
    async function load() {
      const enabled = await getSetting('showChatModel')
      const val = enabled !== false
      setShow(val)
      if (!val) return
      const profile = await getEffectiveProfileFor('chat')
      setModelName(profile?.model ? profile.model.split('/').pop() : '')
      setTopP(getEffectiveTopP(profile))
      setTemperature(getEffectiveTemperature(profile))
      const profileId = await getSetting('requestKind.chat.profileId')
      setProfile(profileId ? await getProfile(profileId) : null)
      setStatusEnabled((await getSetting('showStatus')) !== false)
      const refresh = await getSetting('statusBarRefresh')
      if (typeof refresh === 'number') setStatusBarRefresh(refresh)
    }
    load()
    function onSettingsChanged(e) {
      if (
        e.detail?.key === 'showChatModel' ||
        e.detail?.key === 'showStatus' ||
        e.detail?.key === 'statusBarRefresh' ||
        e.detail?.key === 'requestKind.chat.profileId'
      ) {
        load()
      }
    }
    function onProfileChanged() {
      load()
    }
    window.addEventListener('settings-changed', onSettingsChanged)
    window.addEventListener('connectionProfiles-changed', onProfileChanged)
    return () => {
      window.removeEventListener('settings-changed', onSettingsChanged)
      window.removeEventListener('connectionProfiles-changed', onProfileChanged)
    }
  }, [])

  if (!show || !modelName) return null

  const bar = (
    <div className="px-3 py-1.5 text-center">
      {profile ? (
        <button
          type="button"
          onClick={() => openModal('profileForm', { profile })}
          className="text-xs text-tertiary hover:text-text hover:underline inline-flex items-center gap-1 max-w-full"
          title={t('statusBar.editProfile')}
        >
          {temperature != null && <>{temperature}t · </>}
          {topP != null && <>{topP}p · </>}
          <MarqueeText className="inline-block align-bottom max-w-full">{modelName}</MarqueeText>
          {hordeEta && <> · {hordeEta}</>}
        </button>
      ) : (
        <span className="text-xs text-tertiary">
          {temperature != null && <>{temperature}t · </>}
          {topP != null && <>{topP}p · </>}
          <MarqueeText className="inline-block align-bottom max-w-full">{modelName}</MarqueeText>
          {hordeEta && <> · {hordeEta}</>}
        </span>
      )}
    </div>
  )

  if (embedded) return bar

  return <div className="flex-shrink-0 shadow-input-area bg-surface">{bar}</div>
}
