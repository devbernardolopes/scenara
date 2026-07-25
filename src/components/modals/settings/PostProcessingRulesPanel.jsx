import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getSetting,
  setSetting,
  getPostProcessingRules,
  setPostProcessingRules,
} from '../../../services/settings'
import PostProcessingRuleEditor from '../../shared/PostProcessingRuleEditor'
import SettingToggle from './controls/SettingToggle'

function PostProcessingRulesPanel() {
  const { t } = useTranslation('settings')
  const [rules, setRules] = useState(null)
  const [enabled, setEnabled] = useState(true)
  const [injectQuotes, setInjectQuotes] = useState(true)

  useEffect(() => {
    Promise.all([
      getPostProcessingRules(),
      getSetting('defaultPostProcessing'),
      getSetting('defaultInjectQuotes'),
    ]).then(([r, e, q]) => {
      setRules(r)
      setEnabled(e !== false)
      setInjectQuotes(q !== false)
    })
  }, [])

  async function handleToggle(value) {
    setEnabled(value)
    await setSetting('defaultPostProcessing', value)
  }

  async function handleInjectQuotesToggle(value) {
    setInjectQuotes(value)
    await setSetting('defaultInjectQuotes', value)
  }

  async function handleChange(next) {
    setRules(next)
    await setPostProcessingRules(next)
  }

  if (rules === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-tertiary">{t('loading', { ns: 'common' })}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 min-h-[44px]">
        <div>
          <span className="text-sm text-text">{t('postProcessing.enable.label')}</span>
          <p className="text-xs text-secondary">{t('postProcessing.enable.desc')}</p>
        </div>
        <SettingToggle value={enabled} onChange={handleToggle} />
      </div>
      {enabled && (
        <>
          <div className="flex items-center justify-between gap-3 min-h-[44px]">
            <div>
              <span className="text-sm text-text">{t('postProcessing.injectQuotes.label')}</span>
              <p className="text-xs text-secondary">{t('postProcessing.injectQuotes.desc')}</p>
            </div>
            <SettingToggle value={injectQuotes} onChange={handleInjectQuotesToggle} />
          </div>
          <div className={enabled ? '' : 'opacity-40 pointer-events-none'}>
            <PostProcessingRuleEditor rules={rules} onChange={handleChange} />
          </div>
        </>
      )}
    </div>
  )
}

export default PostProcessingRulesPanel
