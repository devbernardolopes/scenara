import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ModalProvider, registerModal } from './lib/modal'
import App from './App'
import './index.css'

import SettingsModal from './components/modals/SettingsModal'
import CharacterCreateModal from './components/modals/CharacterCreateModal'
import PersonaEditorModal from './components/modals/PersonaEditorModal'

registerModal('settings', SettingsModal)
registerModal('characterCreate', CharacterCreateModal)
registerModal('personaEditor', PersonaEditorModal)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ModalProvider>
        <App />
      </ModalProvider>
    </BrowserRouter>
  </StrictMode>,
)
