import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { exportDatabase } from '../../services/database'
import { downloadJson } from '../../lib/download'
import db from '../../db'
import ModalShell from '../shared/ModalShell'
import CollapsibleSection from '../shared/CollapsibleSection'
import ExportItemRow from '../shared/ExportItemRow'

function ExportDatabaseModal() {
  const { t } = useTranslation('settings')
  const { openModal, closeModal, updateModal } = useModal()

  const [loading, setLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  const [characters, setCharacters] = useState([])
  const [personas, setPersonas] = useState([])
  const [threads, setThreads] = useState([])
  const [writingInstructions, setWritingInstructions] = useState([])
  const [inChatShortcuts, setInChatShortcuts] = useState([])
  const [connectionProfiles, setConnectionProfiles] = useState([])

  const [selectedCharacterIds, setSelectedCharacterIds] = useState(new Set())
  const [selectedPersonaIds, setSelectedPersonaIds] = useState(new Set())
  const [selectedThreadIds, setSelectedThreadIds] = useState(new Set())
  const [selectedWritingInstructionIds, setSelectedWritingInstructionIds] = useState(new Set())
  const [selectedInChatShortcutIds, setSelectedInChatShortcutIds] = useState(new Set())
  const [selectedConnectionProfileIds, setSelectedConnectionProfileIds] = useState(new Set())
  const [selectedTags, setSelectedTags] = useState(true)
  const [selectedSettings, setSelectedSettings] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [chars, pers, thrs, wi, ics, cp] = await Promise.all([
        db.characters.toArray(),
        db.personas.toArray(),
        db.threads.toArray(),
        db.writingInstructions.toArray(),
        db.inChatShortcuts.toArray(),
        db.connectionProfiles.toArray(),
      ])

      chars.sort((a, b) => (b.id || 0) - (a.id || 0))
      pers.sort((a, b) => (b.id || 0) - (a.id || 0))
      thrs.sort((a, b) => (b.id || 0) - (a.id || 0))
      wi.sort((a, b) => (b.id || 0) - (a.id || 0))
      ics.sort((a, b) => (b.id || 0) - (a.id || 0))
      cp.sort((a, b) => (b.id || 0) - (a.id || 0))

      setCharacters(chars)
      setPersonas(pers)
      setThreads(thrs)
      setWritingInstructions(wi)
      setInChatShortcuts(ics)
      setConnectionProfiles(cp)

      setSelectedCharacterIds(new Set(chars.map((c) => c.id)))
      setSelectedPersonaIds(new Set(pers.map((p) => p.id)))
      setSelectedThreadIds(new Set(thrs.map((t) => t.id)))
      setSelectedWritingInstructionIds(new Set(wi.map((w) => w.id)))
      setSelectedInChatShortcutIds(new Set(ics.map((i) => i.id)))
      setSelectedConnectionProfileIds(new Set(cp.map((p) => p.id)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  function toggleAll(setter, allIds) {
    return (e) => {
      if (e.target.checked) {
        setter(new Set(allIds))
      } else {
        setter(new Set())
      }
    }
  }

  function toggleItem(setter) {
    return (id) => {
      setter((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }
  }

  async function handleExport() {
    setIsExporting(true)
    openModal('progress', { status: 'exporting', label: t('database.exportModal.exporting') })

    try {
      const data = await exportDatabase({
        characterIds: selectedCharacterIds,
        personaIds: selectedPersonaIds,
        threadIds: selectedThreadIds,
        writingInstructionIds: selectedWritingInstructionIds,
        inChatShortcutIds: selectedInChatShortcutIds,
        connectionProfileIds: selectedConnectionProfileIds,
        tags: selectedTags,
        settings: selectedSettings,
      })

      const now = new Date()
      const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      downloadJson(data, `scenara-export-${ts}.json`)

      updateModal({ status: 'exported', label: t('database.exportModal.exported') })
    } catch (err) {
      updateModal({ status: 'error', label: err.message || 'Export failed' })
    } finally {
      setIsExporting(false)
    }
  }

  if (loading) {
    return (
      <ModalShell title={t('database.exportModal.title')} onClose={closeModal}>
        <div className="flex items-center justify-center py-12">
          <p className="text-secondary text-sm">{t('common:loading')}</p>
        </div>
      </ModalShell>
    )
  }

  const allCharacterIds = characters.map((c) => c.id)
  const allPersonaIds = personas.map((p) => p.id)
  const allThreadIds = threads.map((t) => t.id)
  const allWritingInstructionIds = writingInstructions.map((w) => w.id)
  const allInChatShortcutIds = inChatShortcuts.map((i) => i.id)
  const allConnectionProfileIds = connectionProfiles.map((p) => p.id)

  const charToggleAll = toggleAll(setSelectedCharacterIds, allCharacterIds)
  const persToggleAll = toggleAll(setSelectedPersonaIds, allPersonaIds)
  const thrToggleAll = toggleAll(setSelectedThreadIds, allThreadIds)
  const wiToggleAll = toggleAll(setSelectedWritingInstructionIds, allWritingInstructionIds)
  const icsToggleAll = toggleAll(setSelectedInChatShortcutIds, allInChatShortcutIds)
  const cpToggleAll = toggleAll(setSelectedConnectionProfileIds, allConnectionProfileIds)

  const charToggle = toggleItem(setSelectedCharacterIds)
  const persToggle = toggleItem(setSelectedPersonaIds)
  const thrToggle = toggleItem(setSelectedThreadIds)
  const wiToggle = toggleItem(setSelectedWritingInstructionIds)
  const icsToggle = toggleItem(setSelectedInChatShortcutIds)
  const cpToggle = toggleItem(setSelectedConnectionProfileIds)

  function renderSectionHeader(label, count, selectedCount, allIds, toggleAllFn) {
    const allChecked = allIds.length > 0 && selectedCount === allIds.length
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <label className="flex items-center min-h-[44px] min-w-[44px] cursor-pointer">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAllFn}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
          </label>
          <span className="text-sm text-secondary">
            {t('database.exportModal.selectUnselectAll')}
          </span>
          <span className="text-xs text-tertiary ml-auto">
            {t('database.exportModal.selectedCount', { count: selectedCount })}
          </span>
        </div>
      </div>
    )
  }

  const footer = (
    <>
      <button
        type="button"
        onClick={closeModal}
        disabled={isExporting}
        className="min-h-[44px] px-4 border border-border rounded-md text-text hover:bg-surface-hover text-sm"
      >
        {t('database.exportModal.cancel')}
      </button>
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        className="min-h-[44px] px-4 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm"
      >
        {t('database.exportModal.export')}
      </button>
    </>
  )

  return (
    <ModalShell
      title={t('database.exportModal.title')}
      onClose={isExporting ? undefined : closeModal}
      footer={footer}
    >
      <div className="space-y-2">
        <CollapsibleSection
          label={t('database.exportModal.characters')}
          summary={`${characters.length}`}
          hasContent={selectedCharacterIds.size > 0}
          storageKey="export.characters"
        >
          {renderSectionHeader(
            t('database.exportModal.characters'),
            characters.length,
            selectedCharacterIds.size,
            allCharacterIds,
            charToggleAll,
          )}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {characters.length === 0 ? (
              <p className="text-xs text-tertiary py-2">{t('database.exportModal.noItems')}</p>
            ) : (
              characters.map((c) => (
                <ExportItemRow
                  key={c.id}
                  checked={selectedCharacterIds.has(c.id)}
                  onChange={() => charToggle(c.id)}
                  avatar={c.avatar}
                  title={c.name}
                  id={c.characterNumber}
                />
              ))
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          label={t('database.exportModal.personas')}
          summary={`${personas.length}`}
          hasContent={selectedPersonaIds.size > 0}
          storageKey="export.personas"
        >
          {renderSectionHeader(
            t('database.exportModal.personas'),
            personas.length,
            selectedPersonaIds.size,
            allPersonaIds,
            persToggleAll,
          )}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {personas.length === 0 ? (
              <p className="text-xs text-tertiary py-2">{t('database.exportModal.noItems')}</p>
            ) : (
              personas.map((p) => (
                <ExportItemRow
                  key={p.id}
                  checked={selectedPersonaIds.has(p.id)}
                  onChange={() => persToggle(p.id)}
                  avatar={p.avatar}
                  title={p.title ? `${p.name} (${p.title})` : p.name}
                  id={p.id}
                />
              ))
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          label={t('database.exportModal.threads')}
          summary={`${threads.length}`}
          hasContent={selectedThreadIds.size > 0}
          storageKey="export.threads"
        >
          {renderSectionHeader(
            t('database.exportModal.threads'),
            threads.length,
            selectedThreadIds.size,
            allThreadIds,
            thrToggleAll,
          )}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {threads.length === 0 ? (
              <p className="text-xs text-tertiary py-2">{t('database.exportModal.noItems')}</p>
            ) : (
              threads.map((thr) => {
                const char = characters.find((c) => c.id === thr.characterId)
                return (
                  <ExportItemRow
                    key={thr.id}
                    checked={selectedThreadIds.has(thr.id)}
                    onChange={() => thrToggle(thr.id)}
                    avatar={char?.avatar}
                    title={thr.title}
                    id={thr.threadNumber}
                  />
                )
              })
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          label={t('database.exportModal.writingInstructions')}
          summary={`${writingInstructions.length}`}
          hasContent={selectedWritingInstructionIds.size > 0}
          storageKey="export.writingInstructions"
        >
          {renderSectionHeader(
            t('database.exportModal.writingInstructions'),
            writingInstructions.length,
            selectedWritingInstructionIds.size,
            allWritingInstructionIds,
            wiToggleAll,
          )}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {writingInstructions.length === 0 ? (
              <p className="text-xs text-tertiary py-2">{t('database.exportModal.noItems')}</p>
            ) : (
              writingInstructions.map((w) => (
                <ExportItemRow
                  key={w.id}
                  checked={selectedWritingInstructionIds.has(w.id)}
                  onChange={() => wiToggle(w.id)}
                  title={w.name}
                  id={w.id}
                />
              ))
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          label={t('database.exportModal.inChatShortcuts')}
          summary={`${inChatShortcuts.length}`}
          hasContent={selectedInChatShortcutIds.size > 0}
          storageKey="export.inChatShortcuts"
        >
          {renderSectionHeader(
            t('database.exportModal.inChatShortcuts'),
            inChatShortcuts.length,
            selectedInChatShortcutIds.size,
            allInChatShortcutIds,
            icsToggleAll,
          )}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {inChatShortcuts.length === 0 ? (
              <p className="text-xs text-tertiary py-2">{t('database.exportModal.noItems')}</p>
            ) : (
              inChatShortcuts.map((i) => (
                <ExportItemRow
                  key={i.id}
                  checked={selectedInChatShortcutIds.has(i.id)}
                  onChange={() => icsToggle(i.id)}
                  title={i.name}
                  id={i.id}
                />
              ))
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          label={t('database.exportModal.connectionProfiles')}
          summary={`${connectionProfiles.length}`}
          hasContent={selectedConnectionProfileIds.size > 0}
          storageKey="export.connectionProfiles"
        >
          {renderSectionHeader(
            t('database.exportModal.connectionProfiles'),
            connectionProfiles.length,
            selectedConnectionProfileIds.size,
            allConnectionProfileIds,
            cpToggleAll,
          )}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {connectionProfiles.length === 0 ? (
              <p className="text-xs text-tertiary py-2">{t('database.exportModal.noItems')}</p>
            ) : (
              connectionProfiles.map((p) => (
                <ExportItemRow
                  key={p.id}
                  checked={selectedConnectionProfileIds.has(p.id)}
                  onChange={() => cpToggle(p.id)}
                  title={p.name}
                  id={p.id}
                />
              ))
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          label={t('database.exportModal.lorebooks')}
          summary="0"
          hasContent={false}
          storageKey="export.lorebooks"
          defaultExpanded={false}
        >
          <p className="text-xs text-tertiary py-2">
            {t('database.exportModal.lorebooksDisabled')}
          </p>
        </CollapsibleSection>

        <div className="flex items-center gap-3 p-3 rounded-md hover:bg-surface-hover">
          <label className="flex items-center min-h-[44px] min-w-[44px] cursor-pointer">
            <input
              type="checkbox"
              checked={selectedTags}
              onChange={(e) => setSelectedTags(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
          </label>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-text">{t('database.exportModal.tags')}</span>
            <span className="text-xs text-tertiary ml-2">
              {t('database.exportModal.tagsDescription')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-md hover:bg-surface-hover">
          <label className="flex items-center min-h-[44px] min-w-[44px] cursor-pointer">
            <input
              type="checkbox"
              checked={selectedSettings}
              onChange={(e) => setSelectedSettings(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
          </label>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-text">
              {t('database.exportModal.settings')}
            </span>
            <span className="text-xs text-tertiary ml-2">
              {t('database.exportModal.settingsDescription')}
            </span>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

export default ExportDatabaseModal
