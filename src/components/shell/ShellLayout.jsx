import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useModal } from '../../hooks/useModal'
import { importCharacterFromFile } from '../../services/characters'
import { showToast } from '../../lib/toast'
import i18n from '../../lib/i18n'
import Sidebar from './Sidebar'
import SidebarToggle from './SidebarToggle'
import HomeButton from './HomeButton'
import LastChatButton from './LastChatButton'
import ToastContainer from '../shared/ToastContainer'
import ToastObserver from '../shared/ToastObserver'
import { initInferenceWorker } from '../../lib/inferenceClient'
import { FileUp } from '../../lib/icons'

const ACCEPTED_EXTENSIONS = ['.json', '.png']

function ShellLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragCounterRef = useRef(0)
  const { openModal } = useModal()

  useEffect(() => {
    initInferenceWorker()
  }, [])

  function handleDragEnter(e) {
    e.preventDefault()
    dragCounterRef.current++
    if (dragCounterRef.current === 1) {
      setDragging(true)
    }
  }

  function handleDragLeave(e) {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setDragging(false)
    }
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  async function handleDrop(e) {
    e.preventDefault()
    dragCounterRef.current = 0
    setDragging(false)

    const file = e.dataTransfer?.files?.[0]
    if (!file) return

    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      showToast(i18n.t('common:sidebar.importUnsupportedFile'), { type: 'error' })
      return
    }

    try {
      const data = await importCharacterFromFile(file)
      openModal('characterCreate', { initialData: data })
    } catch (err) {
      showToast(err.message || i18n.t('common:toast.import.invalidFormat'), { type: 'error' })
    }
  }

  return (
    <div
      className="flex h-full bg-surface text-text relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex-1 overflow-auto min-w-0 relative main-content">
          <Outlet />
        </main>
      </div>
      <SidebarToggle open={sidebarOpen} onToggle={() => setSidebarOpen((prev) => !prev)} />
      <HomeButton open={sidebarOpen} />
      <LastChatButton open={sidebarOpen} />
      <ToastContainer />
      <ToastObserver />
      {dragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-overlay">
          <div className="flex flex-col items-center gap-4 p-12 rounded-xl border-2 border-dashed border-accent bg-surface/90 shadow-surface-lg">
            <FileUp className="w-12 h-12 text-accent" />
            <p className="text-lg font-medium text-text">
              {i18n.t('common:shell.dropCharacterFile')}
            </p>
            <p className="text-sm text-secondary">JSON or PNG</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default ShellLayout
