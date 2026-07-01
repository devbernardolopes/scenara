import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getSetting } from '../../../services/settings'
import SettingToggle from './controls/SettingToggle'
import SettingSelect from './controls/SettingSelect'
import SettingSlider from './controls/SettingSlider'
import SettingInput from './controls/SettingInput'
import SettingTextarea from './controls/SettingTextarea'

const CONTROL_MAP = {
  toggle: SettingToggle,
  select: SettingSelect,
  slider: SettingSlider,
  text: SettingInput,
  textarea: SettingTextarea,
}

function SettingRow({ setting, onSave }) {
  const { t } = useTranslation('settings')
  const [value, setValue] = useState(setting.default)

  useEffect(() => {
    getSetting(setting.key).then((v) => {
      if (v !== null && v !== undefined) setValue(v)
    })
  }, [setting.key])

  const handleChange = (next) => {
    setValue(next)
    onSave(next)
  }

  const labelPath = setting.labelKey.replace('settings:', '')
  const descPath = setting.descKey?.replace('settings:', '')
  const Control = CONTROL_MAP[setting.type]

  if (!Control) return null

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <label className="block text-sm font-medium text-text">{t(labelPath)}</label>
        {descPath && <p className="text-xs text-secondary mt-0.5">{t(descPath)}</p>}
      </div>
      <div className="shrink-0">
        <Control value={value} onChange={handleChange} storageKey={setting.key} {...setting.props} />
      </div>
    </div>
  )
}

export default SettingRow
