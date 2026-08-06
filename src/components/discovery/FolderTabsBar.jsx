import { useTranslation } from 'react-i18next'
import { Plus } from '../../lib/icons'

function FolderTabsBar({ folders, activeFolderId, onSelect, onManage }) {
  const { t } = useTranslation('common')
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() => onSelect('all')}
        className={`shrink-0 min-h-[36px] px-3 rounded-full text-sm border whitespace-nowrap ${
          activeFolderId === 'all'
            ? 'border-primary bg-primary-subtle text-primary'
            : 'border-border bg-surface-secondary text-text hover:border-border-light'
        }`}
      >
        {t('discovery.folders.all')}
      </button>
      {folders.map((folder) => (
        <button
          key={folder.id}
          type="button"
          onClick={() => onSelect(folder.id)}
          className={`shrink-0 min-h-[36px] px-3 rounded-full text-sm border whitespace-nowrap ${
            activeFolderId === folder.id
              ? 'border-primary bg-primary-subtle text-primary'
              : 'border-border bg-surface-secondary text-text hover:border-border-light'
          }`}
        >
          {folder.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onManage}
        className="shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full border border-dashed border-border text-secondary hover:text-text hover:border-border-light"
        aria-label={t('discovery.folders.manage')}
        title={t('discovery.folders.manage')}
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  )
}

export default FolderTabsBar
