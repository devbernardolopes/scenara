import { useTranslation } from 'react-i18next'
import { Menu } from '../../lib/icons'

function TopBar({ onMenuToggle }) {
  const { t } = useTranslation('common')

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
    </header>
  )
}

export default TopBar
