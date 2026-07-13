import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getSetting,
  setSetting,
  getPostProcessingRules,
  setPostProcessingRules,
} from '../../../services/settings'
import PostProcessingRuleEditor from '../../shared/PostProcessingRuleEditor'

function PostProcessingRulesPanel() {
  const { t } = useTranslation('settings')
  const [rules, setRules] = useState(null)
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    Promise.all([getPostProcessingRules(), getSetting('defaultPostProcessing')]).then(([r, e]) => {
      setRules(r)
      setEnabled(e !== false)
    })
  }, [])

  async function handleToggle(value) {
    setEnabled(value)
    await setSetting('defaultPostProcessing', value)
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
      <label className="flex items-center justify-between gap-3 min-h-[44px] cursor-pointer">
        <div>
          <span className="text-sm text-text">{t('postProcessing.enable.label')}</span>
          <p className="text-xs text-secondary">{t('postProcessing.enable.desc')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!enabled}
          onClick={() => handleToggle(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
            enabled ? 'bg-primary' : 'bg-gray-300'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </label>
      <div className={enabled ? '' : 'opacity-40 pointer-events-none'}>
        <PostProcessingRuleEditor rules={rules} onChange={handleChange} />
      </div>
    </div>
  )
}

export default PostProcessingRulesPanel
