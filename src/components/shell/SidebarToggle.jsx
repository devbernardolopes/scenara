import { useTranslation } from 'react-i18next'
import { Menu } from '../../lib/icons'
import { useModal } from '../../hooks/useModal'

function SidebarToggle({ open, onToggle }) {
  const { t } = useTranslation('common')
  const { activeModal } = useModal()
  const hidden = open || activeModal

  return (
    <button
      onClick={onToggle}
      className={`fixed bottom-24 left-4 z-20 md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-surface border border-border shadow-surface-md text-tertiary hover:text-text hover:bg-surface-hover transition-all duration-200 ease-in-out ${hidden ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'}`}
      aria-label={t('topbar.toggleSidebar')}
    >
      <Menu className="w-6 h-6" />
    </button>
  )
}

export default SidebarToggle
