import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import SidebarToggle from './SidebarToggle'
import ToastContainer from '../shared/ToastContainer'
import ToastObserver from '../shared/ToastObserver'

function ShellLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-surface text-text">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 overflow-auto min-w-0">
        <Outlet />
      </main>
      <SidebarToggle open={sidebarOpen} onToggle={() => setSidebarOpen((prev) => !prev)} />
      <ToastContainer />
      <ToastObserver />
    </div>
  )
}

export default ShellLayout
