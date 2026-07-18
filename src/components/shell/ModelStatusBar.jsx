import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from '../../lib/icons'
import { getSetting, setSetting } from '../../services/settings'
import {
  getEffectiveProfileFor,
  getEffectiveTopP,
  getEffectiveTemperature,
} from '../../services/connectionProfiles'
import { useHordeEta } from '../../hooks/useHordeEta'
import MarqueeText from '../shared/MarqueeText'

export default function ModelStatusBar({ embedded = false }) {
  const { t } = useTranslation('common')
  const [show, setShow] = useState(true)
  const [modelName, setModelName] = useState('')
  const [topP, setTopP] = useState(null)
  const [temperature, setTemperature] = useState(null)
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

  const handleDismiss = () => {
    setShow(false)
    setSetting('showChatModel', false)
  }

  const info = (
    <span className="flex items-center gap-2 whitespace-nowrap">
      {temperature != null && <span>T {temperature}</span>}
      {topP != null && <span>{t('topP', { value: topP })}</span>}
      {hordeEta && <span>{t('eta', { value: hordeEta })}</span>}
    </span>
  )

  const content = (
    <div className="flex items-center gap-2 px-3 py-1.5 min-w-0">
      <div className="flex-1 min-w-0 flex justify-center text-xs text-tertiary">
        <MarqueeText className="max-w-full">{modelName}</MarqueeText>
      </div>
      <span className="shrink-0 text-xs text-tertiary">{info}</span>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 w-[26px] h-[26px] flex items-center justify-center rounded text-tertiary hover:text-text hover:bg-surface-hover"
        aria-label={t('dismissModelBar')}
        title={t('dismissModelBar')}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )

  if (embedded) return content

  return <div className="flex-shrink-0 border-t border-border bg-surface">{content}</div>
}
