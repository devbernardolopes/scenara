import { Routes, Route } from 'react-router-dom'
import ShellLayout from './components/shell/ShellLayout'
import CharacterDiscovery from './pages/CharacterDiscovery'
import ChatView from './pages/ChatView'
import { useViewportHeight } from './hooks/useViewportHeight'

function App() {
  // useViewportHeight()

  return (
    <Routes>
      <Route element={<ShellLayout />}>
        <Route index element={<CharacterDiscovery />} />
        <Route path="chat/:threadId" element={<ChatView />} />
      </Route>
    </Routes>
  )
}

export default App
