import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useModal } from '../../../hooks/useModal'
import { useConfirm } from '../../../lib/confirm'
import { showToast } from '../../../lib/toast'
import { downloadJson } from '../../../lib/download'
import CloseButton from '../../shared/CloseButton'
import ListEntryCard from '../../shared/ListEntryCard'
import { SortableList, SortableItem } from '../../shared/SortableList'
import { Plus, Upload } from '../../../lib/icons'

/**
 * Generic "list management" modal shared by the Persona, Connection Profile,
 * Writing Instruction, In-Chat Shortcut, and Lorebook families. All layout,
 * action order, reordering, checkboxes and batch footer are identical; only the
 * config differs per entity.
 *
 * config shape:
 *   entityKey:        string  — i18n root key in settings.json + toast key in common.json
 *   titleKey:         string  — settings.json title (defaults to `${entityKey}.title`)
 *   changeEvent:      string  — window CustomEvent name fired on data changes
 *   icon:             Lucide   — fallback tile icon when showImage is false
 *   showImage:        boolean — render the avatar tile (true) vs the icon tile (false)
 *   squaredImage:     boolean — force 44x44 squared avatar (Persona/Profile/Lorebook)
 *   showSetDefault:   boolean — render the star "set as default" action (Persona only)
 *   canCreate:        boolean — show the Add button / allow create
 *   createLabelKey:   string  — defaults to `${entityKey}.create`
 *   importLabelKey:   string  — defaults to `${entityKey}.import`
 *   noItemsKey:       string  — defaults to `${entityKey}.noItems`
 *   getTitle:         (item) => string
 *   getSubtitle:      (item) => string|null
 *   getImageSrc:      (item) => string|null
 *   getBadges:        (item) => ReactNode|null
 *   isDefault:        (item) => boolean
 *   disableDelete:    (item, all) => boolean
 *   confirmDelete:    (item) => Promise<{ok, children?}>  (run before delete)
 *   formModal:        string  — modal type opened for create/edit
 *   formProp:         string  — prop name carrying the item on edit
 *   service: {
 *     getAll, delete, deleteMany, duplicate, duplicateMany,
 *     exportOne, exportMany, importMany, updateOrder
 *   }
 */
function ListManagementModal({ config }) {
  const { t } = useTranslation('settings')
  const { openModal, closeModal } = useModal()
  const { confirm } = useConfirm()

  const entityKey = config.entityKey
  const titleKey = config.titleKey || `${entityKey}.title`
  const createLabelKey = config.createLabelKey || `${entityKey}.create`
  const importLabelKey = config.importLabelKey || `${entityKey}.import`
  const noItemsKey = config.noItemsKey || `${entityKey}.noItems`

  const [items, setItems] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const importRef = useRef(null)

  const firstLoad = useRef(true)
  const load = useCallback(async () => {
    if (firstLoad.current) setLoading(true)
    try {
      const data = await config.service.getAll()
      setItems(data)
    } finally {
      if (firstLoad.current) {
        setLoading(false)
        firstLoad.current = false
      }
    }
  }, [config])

  useEffect(() => {
    load()
    const evt = config.changeEvent
    window.addEventListener(evt, load)
    return () => window.removeEventListener(evt, load)
  }, [load, config])

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function startCreate() {
    openModal(config.formModal)
  }

  function startEdit(item) {
    if (!config.formModal) return
    openModal(config.formModal, { [config.formProp]: item })
  }

  async function handleDelete(item) {
    const result = config.confirmDelete ? await config.confirmDelete(item) : { ok: true }
    if (!result || !result.ok) return
    await config.service.delete(item.id)
    if (selectedIds.has(item.id)) clearSelection()
  }

  async function handleDeleteSelected() {
    if (selectedIds.size >= items.length) return
    const ok = await confirm({
      title: t(`${entityKey}.confirmDelete.title`),
      message: t(`${entityKey}.confirmDelete.messageMultiple`, { count: selectedIds.size }),
      confirmLabel: t(`${entityKey}.actions.delete`),
      cancelLabel: t('common:cancel'),
      variant: 'danger',
    })
    if (!ok) return
    try {
      await config.service.deleteMany([...selectedIds])
    } catch {
      return
    }
    clearSelection()
  }

  async function handleDuplicate(item) {
    await config.service.duplicate(item.id)
  }

  async function handleDuplicateSelected() {
    await config.service.duplicateMany([...selectedIds])
    clearSelection()
  }

  async function handleExportSingle(item) {
    const data = await config.service.exportOne(item.id)
    const safe = (config.getTitle(item) || 'item').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    downloadJson(data, `${entityKey}-${safe}.json`)
  }

  async function handleExportSelected() {
    const data = await config.service.exportMany([...selectedIds])
    downloadJson({ [entityKey]: data }, `${entityKey}s-export.json`)
    clearSelection()
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const text = await file.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        showToast(t(`${entityKey}.import.invalidFormat`), { type: 'error' })
        return
      }
      const arr = Array.isArray(data) ? data : data[entityKey] ? data[entityKey] : [data]
      const added = await config.service.importMany(arr)
      if (!added || added.length === 0) {
        showToast(t(`${entityKey}.import.invalidFormat`), { type: 'error' })
      }
    } catch {
      showToast(t(`${entityKey}.import.fileError`), { type: 'error' })
    }
  }

  const multi = selectedIds.size > 0

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 border-b border-border shrink-0">
        <h2 className="text-xl font-semibold text-text">{t(titleKey)}</h2>
        <CloseButton onClick={closeModal} />
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {config.canCreate !== false && (
              <button
                type="button"
                onClick={startCreate}
                className="min-h-[44px] px-4 bg-primary text-on-primary rounded-md hover:bg-primary-hover text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> {t(createLabelKey)}
              </button>
            )}
            {config.canImport !== false && (
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="min-h-[44px] px-4 border border-border rounded-md text-text hover:bg-surface-hover text-sm flex items-center gap-2"
              >
                <Upload className="w-4 h-4" /> {t(importLabelKey)}
              </button>
            )}
            <input
              ref={importRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          {config.comingSoonNoteKey ? (
            <p className="text-xs text-tertiary">{t(config.comingSoonNoteKey)}</p>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-secondary text-sm">{t('common:loading')}</p>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-secondary py-8 text-center">{t(noItemsKey)}</p>
          ) : (
            <>
              <div className="space-y-3">
                <SortableList
                  items={items}
                  getId={(i) => i.id}
                  onReorder={(ids) => config.service.updateOrder(ids)}
                >
                  {(item) => (
                    <SortableItem id={item.id} key={item.id}>
                      {(sortable) => (
                        <ListEntryCard
                          item={item}
                          title={config.getTitle(item)}
                          subtitle={config.getSubtitle ? config.getSubtitle(item) : null}
                          badges={config.getBadges ? config.getBadges(item) : null}
                          imageSrc={config.showImage ? config.getImageSrc(item) : null}
                          icon={config.showImage ? null : config.icon}
                          tile={config.getTile ? config.getTile(item) : null}
                          selected={selectedIds.has(item.id)}
                          onToggleSelect={toggleSelect}
                          onEdit={startEdit}
                          showSetDefault={config.showSetDefault}
                          isDefault={config.isDefault ? config.isDefault(item) : false}
                          onSetDefault={config.onSetDefault}
                          onDuplicate={handleDuplicate}
                          onExport={handleExportSingle}
                          onDelete={handleDelete}
                          disableDelete={
                            config.disableDelete ? config.disableDelete(item, items) : false
                          }
                          setNodeRef={sortable.setNodeRef}
                          style={sortable.style}
                          dragHandleProps={sortable.dragHandleProps}
                        />
                      )}
                    </SortableItem>
                  )}
                </SortableList>
              </div>

              {multi && (
                <div className="sticky bottom-0 flex items-center gap-2 p-3 bg-surface border border-border rounded-lg shadow-surface-md">
                  <span className="text-sm text-secondary mr-2">
                    {t(`${entityKey}.batch.selected`, { count: selectedIds.size })}
                  </span>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="min-h-[44px] px-3 text-sm text-on-delete bg-delete hover:bg-delete-hover rounded-md"
                  >
                    {t(`${entityKey}.batch.delete`, { count: selectedIds.size })}
                  </button>
                  <button
                    type="button"
                    onClick={handleDuplicateSelected}
                    className="min-h-[44px] px-3 text-sm text-text hover:bg-surface-hover rounded-md"
                  >
                    {t(`${entityKey}.batch.duplicate`, { count: selectedIds.size })}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportSelected}
                    className="min-h-[44px] px-3 text-sm text-text hover:bg-surface-hover rounded-md"
                  >
                    {t(`${entityKey}.batch.export`, { count: selectedIds.size })}
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="min-h-[44px] px-3 text-sm text-secondary hover:text-text ml-auto"
                  >
                    {t(`${entityKey}.batch.clear`)}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ListManagementModal
