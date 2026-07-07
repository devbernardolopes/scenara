import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getSetting } from '../../../services/settings'
import SettingToggle from './controls/SettingToggle'
import SettingSelect from './controls/SettingSelect'
import SettingSlider from './controls/SettingSlider'
import SettingInput from './controls/SettingInput'
import SettingTextarea from './controls/SettingTextarea'
import SettingButtonOrder from './controls/SettingButtonOrder'
import SettingAvatarPicker from './controls/SettingAvatarPicker'
import SettingOocDelimiters from './controls/SettingOocDelimiters'

const CONTROL_MAP = {
  toggle: SettingToggle,
  select: SettingSelect,
  slider: SettingSlider,
  text: SettingInput,
  textarea: SettingTextarea,
  buttonOrder: SettingButtonOrder,
  avatar: SettingAvatarPicker,
  oocDelimiters: SettingOocDelimiters,
}

function SettingRow({ setting, onSave }) {
  const { t } = useTranslation('settings')
  const [value, setValue] = useState(setting.default)
  const [depValues, setDepValues] = useState({})
  const dependsOn = setting.dependsOn
  const dependsOnList = Array.isArray(dependsOn) ? dependsOn : dependsOn ? [dependsOn] : []

  useEffect(() => {
    getSetting(setting.key).then((v) => {
      if (v !== null && v !== undefined) setValue(v)
    })
  }, [setting.key])

  useEffect(() => {
    if (dependsOnList.length === 0) return
    const keys = dependsOnList.map((d) => d.key)
    Promise.all(keys.map((k) => getSetting(k))).then((values) => {
      const map = {}
      keys.forEach((k, i) => (map[k] = values[i]))
      setDepValues(map)
    })
    const handler = (e) => {
      if (keys.includes(e.detail.key)) {
        getSetting(e.detail.key).then((v) =>
          setDepValues((prev) => ({ ...prev, [e.detail.key]: v })),
        )
      }
    }
    window.addEventListener('settings-changed', handler)
    return () => window.removeEventListener('settings-changed', handler)
  }, [dependsOn]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const disabled =
    dependsOnList.length > 0 && !dependsOnList.every((d) => depValues[d.key] === d.value)

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 ${disabled ? 'opacity-50' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <label className="block text-sm font-medium text-text">{t(labelPath)}</label>
        {descPath && <p className="text-xs text-secondary mt-0.5">{t(descPath)}</p>}
      </div>
      <div className="w-full sm:max-w-sm min-w-0">
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
