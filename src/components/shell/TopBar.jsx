import { useTranslation } from 'react-i18next'
import { useModal } from '../../hooks/useModal'

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
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <div className="flex-1" />

      <button
        onClick={() => openModal('settings', { modalSize: 'lg' })}
        className="text-tertiary hover:text-text min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-surface-hover"
        aria-label={t('topbar.settings')}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
    </header>
  )
}

export default TopBar
