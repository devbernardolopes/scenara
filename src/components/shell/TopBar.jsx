import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'
import { Menu, Settings } from '../../lib/icons'

function TopBar({ onMenuToggle }) {
  const { t } = useTranslation('common')
  const { openModal } = useModal()

  return (
    <header className="flex items-center justify-between px-4 h-14 border-b border-border bg-surface shrink-0">
      <button
        onClick={onMenuToggle}
        className="text-tertiary hover:text-text md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label={t('topbar.toggleSidebar')}
      >
        <Menu className="w-6 h-6" />
      </button>

      <div className="flex-1" />

      <button
        onClick={() => openModal('settings', { modalSize: 'lg' })}
        className="text-tertiary hover:text-text min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-surface-hover"
        aria-label={t('topbar.settings')}
      >
        <Settings className="w-5 h-5" />
      </button>
    </header>
  )
}

export default TopBar
