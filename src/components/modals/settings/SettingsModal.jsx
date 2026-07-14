import { useTranslation } from 'react-i18next'
import { useModal } from '../../../hooks/useModal'
import { usePersistedState } from '../../../hooks/usePersistedState'
import { CATEGORIES, GROUPS, SETTINGS, setSetting } from '../../../services/settings'
import { useConfirm } from '../../../lib/confirm'
import { RefreshCw } from '../../../lib/icons'
import SettingsSidebar from './SettingsSidebar'
import SettingsSearch from './SettingsSearch'
import SettingRow from './SettingRow'
import CollapsibleSection from '../../shared/CollapsibleSection'
import ApiSettingsPanel from './ApiSettingsPanel'
import DatabaseSettingsPanel from './DatabaseSettingsPanel'
import PostProcessingRulesPanel from './PostProcessingRulesPanel'
import CloseButton from '../../shared/CloseButton'
import pkg from '../../../../package.json'

function SettingsModal() {
  const { closeModal } = useModal()
  const { t } = useTranslation('settings')
  const confirm = useConfirm()
  const [activeCategory, setActiveCategory] = usePersistedState(
    'modal.settings.category',
    CATEGORIES[0]?.id,
  )
  const [search, setSearch] = usePersistedState('modal.settings.search', '')

  const filtered = SETTINGS.filter((s) => {
    const matchesCategory = search ? true : s.category === activeCategory
    if (!matchesCategory) return false
    if (!search) return true
    const label = t(s.labelKey).toLowerCase()
    const desc = s.descKey ? t(s.descKey).toLowerCase() : ''
    const q = search.toLowerCase()
    return label.includes(q) || desc.includes(q)
  })

  const noResults = search && filtered.length === 0

  function groupedSettings(settings) {
    const settingsByGroup = new Map()
    for (const s of settings) {
      if (s.group) {
        if (!settingsByGroup.has(s.group)) settingsByGroup.set(s.group, [])
        settingsByGroup.get(s.group).push(s)
      }
    }

    const groupNodes = new Map()
    for (const [key, items] of settingsByGroup) {
      groupNodes.set(key, {
        key,
        def: GROUPS.find((g) => g.key === key),
        items,
        children: [],
      })
    }

    for (const [, node] of groupNodes) {
      const parentKey = node.def?.parent
      if (parentKey && groupNodes.has(parentKey)) {
        groupNodes.get(parentKey).children.push(node)
      }
    }

    const emittedRoots = new Set()
    const roots = []
    for (const s of settings) {
      if (!s.group) {
        roots.push({ setting: s })
        continue
      }
      const node = groupNodes.get(s.group)
      if (!node) {
        roots.push({ setting: s })
        continue
      }
      let cur = node
      while (cur.def?.parent && groupNodes.has(cur.def.parent)) {
        cur = groupNodes.get(cur.def.parent)
      }
      if (emittedRoots.has(cur.key)) continue
      emittedRoots.add(cur.key)
      roots.push(groupNodes.get(cur.key))
    }
    return roots
  }

  function renderGroupNode(node) {
    if (node.setting) {
      return (
        <SettingRow
          key={node.setting.key}
          setting={node.setting}
          onSave={(v) => setSetting(node.setting.key, v)}
        />
      )
    }
    const groupDef = node.def
    return (
      <CollapsibleSection
        key={node.key}
        label={groupDef ? t(groupDef.labelKey.replace('settings:', '')) : node.key}
        storageKey={`settings.group.${node.key}`}
        defaultExpanded={groupDef?.defaultExpanded ?? true}
      >
        <div className="space-y-4">
          {node.items.map((setting) => (
            <SettingRow
              key={setting.key}
              setting={setting}
              onSave={(v) => setSetting(setting.key, v)}
            />
          ))}
          {node.children.map((child) => renderGroupNode(child))}
        </div>
      </CollapsibleSection>
    )
  }

  async function handleRefresh() {
    const ok = await confirm({
      title: t('refreshApp.confirmTitle'),
      message: t('refreshApp.confirmMessage'),
      confirmLabel: t('common:confirm'),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (ok) window.location.reload()
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            aria-label={t('refreshApp.label')}
            title={t('refreshApp.label')}
            className="p-2 rounded-md text-secondary hover:bg-surface-hover hover:text-text min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-semibold text-text">{t('title')}</h2>
        </div>
        <CloseButton onClick={closeModal} />
      </div>

      <div className="px-6 pt-4 pb-2 shrink-0 space-y-2">
        {!search && (
          <select
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
            className="w-full px-3 py-2 min-h-[44px] border border-border rounded-md bg-surface text-text text-sm md:hidden"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {t(cat.labelKey.replace('settings:', ''))}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {!search && (
          <SettingsSidebar
            categories={CATEGORIES}
            active={activeCategory}
            onSelect={setActiveCategory}
          />
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {noResults ? (
            <p className="text-secondary text-sm">{t('noResults')}</p>
          ) : !search && activeCategory === 'api' ? (
            <ApiSettingsPanel />
          ) : !search && activeCategory === 'database' ? (
            <DatabaseSettingsPanel />
          ) : !search && activeCategory === 'postProcessing' ? (
            <PostProcessingRulesPanel />
          ) : (
            <div className="space-y-8">
              {groupedSettings(filtered).map((node) => renderGroupNode(node))}
            </div>
          )}
        </div>
      </div>
      <div className="px-6 py-3 border-t border-border shrink-0">
        <p className="text-xs text-tertiary">
          {t('versionLabel')} v{pkg.version}
        </p>
      </div>
    </div>
  )
}

export default SettingsModal
