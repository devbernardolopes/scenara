import { StrictMode, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ModalProvider, registerModal } from './lib/modal'
import { ConfirmProvider } from './lib/confirm'
import { SaveConfirmProvider } from './lib/saveConfirm'
import { ThemeProvider } from './hooks/useTheme'
import { LocaleProvider } from './hooks/useLocale'
import App from './App'
import './lib/i18n'
import './index.css'

import CharacterCreateModal from './components/modals/CharacterCreateModal'
import PersonaEditorModal from './components/modals/PersonaEditorModal'

const SettingsModal = lazy(() => import('./components/modals/settings/SettingsModal'))

registerModal('settings', SettingsModal)
registerModal('characterCreate', CharacterCreateModal)
registerModal('personaEditor', PersonaEditorModal)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LocaleProvider>
        <ThemeProvider>
          <ModalProvider>
            <ConfirmProvider>
              <SaveConfirmProvider>
                <App />
              </SaveConfirmProvider>
            </ConfirmProvider>
          </ModalProvider>
        </ThemeProvider>
      </LocaleProvider>
    </BrowserRouter>
  </StrictMode>,
)
