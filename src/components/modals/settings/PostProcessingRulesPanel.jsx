import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getPostProcessingRules, setPostProcessingRules } from '../../../services/settings'
import PostProcessingRuleEditor from '../../shared/PostProcessingRuleEditor'

function PostProcessingRulesPanel() {
  const { t } = useTranslation('settings')
  const [rules, setRules] = useState(null)

  useEffect(() => {
    getPostProcessingRules().then(setRules)
  }, [])

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
      <p className="text-xs text-secondary">{t('postProcessing.panelDesc')}</p>
      <PostProcessingRuleEditor rules={rules} onChange={handleChange} />
    </div>
  )
}

export default PostProcessingRulesPanel
