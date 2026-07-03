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
  const [depValue, setDepValue] = useState(null)
  const dependsOn = setting.dependsOn

  useEffect(() => {
    getSetting(setting.key).then((v) => {
      if (v !== null && v !== undefined) setValue(v)
    })
  }, [setting.key])

  useEffect(() => {
    if (!dependsOn) return
    getSetting(dependsOn.key).then(setDepValue)
    const handler = (e) => {
      if (e.detail.key === dependsOn.key) {
        getSetting(dependsOn.key).then(setDepValue)
      }
    }
    window.addEventListener('settings-changed', handler)
    return () => window.removeEventListener('settings-changed', handler)
  }, [dependsOn])

  const handleChange = (next) => {
    setValue(next)
    onSave(next)
  }

  const labelPath = setting.labelKey.replace('settings:', '')
  const descPath = setting.descKey?.replace('settings:', '')
  const Control = CONTROL_MAP[setting.type]
  const {
    key,
    category,
    default: def,
    labelKey,
    descKey,
    type,
    props: extraProps,
    ...controlProps
  } = setting

  if (!Control) return null

  const disabled = dependsOn ? depValue !== dependsOn.value : false

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 ${disabled ? 'opacity-50' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <label className="block text-sm font-medium text-text">{t(labelPath)}</label>
        {descPath && <p className="text-xs text-secondary mt-0.5">{t(descPath)}</p>}
      </div>
      <div className="w-full sm:w-auto sm:shrink-0 min-w-0">
        <Control
          value={value}
          onChange={handleChange}
          disabled={disabled}
          storageKey={key}
          {...extraProps}
          {...controlProps}
        />
      </div>
    </div>
  )
}

export default SettingRow
