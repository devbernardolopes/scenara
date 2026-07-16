import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import SidebarToggle from './SidebarToggle'
import ModelStatusBar from './ModelStatusBar'
import ToastContainer from '../shared/ToastContainer'
import ToastObserver from '../shared/ToastObserver'
import { initInferenceWorker } from '../../lib/inferenceClient'

function ShellLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

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
        {!location.pathname.startsWith('/chat/') && <ModelStatusBar />}
      </div>
      <SidebarToggle open={sidebarOpen} onToggle={() => setSidebarOpen((prev) => !prev)} />
      <ToastContainer />
      <ToastObserver />
    </div>
  )
}

export default ShellLayout
