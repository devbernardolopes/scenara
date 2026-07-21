import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import SidebarToggle from './SidebarToggle'
import HomeButton from './HomeButton'
import LastChatButton from './LastChatButton'
import ToastContainer from '../shared/ToastContainer'
import ToastObserver from '../shared/ToastObserver'
import { initInferenceWorker } from '../../lib/inferenceClient'

function ShellLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    initInferenceWorker()
  }, [])

  return (
    <div className="flex h-full bg-surface text-text">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 overflow-auto min-w-0">
          <Outlet />
        </main>
      </div>
      <SidebarToggle open={sidebarOpen} onToggle={() => setSidebarOpen((prev) => !prev)} />
      <HomeButton open={sidebarOpen} />
      <LastChatButton open={sidebarOpen} />
      <ToastContainer />
      <ToastObserver />
    </div>
  )
}

export default ShellLayout
