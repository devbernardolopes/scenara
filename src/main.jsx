import { StrictMode, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ModalProvider, registerModal } from './lib/modal'
import { ConfirmProvider } from './lib/confirm'
import { SaveConfirmProvider } from './lib/saveConfirm'
import { ThemeProvider } from './hooks/useTheme'
import { LocaleProvider } from './hooks/useLocale'
import { ToastProvider } from './lib/toast'
import App from './App'
import './lib/i18n'
import './index.css'

import CharacterCreateModal from './components/modals/CharacterCreateModal'
import PersonaEditorModal from './components/modals/PersonaEditorModal'
import PersonaFormModal from './components/modals/PersonaFormModal'
import PersonaManagementModal from './components/modals/PersonaManagementModal'
import EditThreadTitleModal from './components/modals/EditThreadTitleModal'
import WritingInstructionManagementModal from './components/modals/WritingInstructionManagementModal'
import WritingInstructionFormModal from './components/modals/WritingInstructionFormModal'

const SettingsModal = lazy(() => import('./components/modals/settings/SettingsModal'))

registerModal('settings', SettingsModal)
registerModal('characterCreate', CharacterCreateModal)
registerModal('personaEditor', PersonaEditorModal)
registerModal('personaForm', PersonaFormModal)
registerModal('personaManagement', PersonaManagementModal)
registerModal('editThreadTitle', EditThreadTitleModal)
registerModal('writingInstructionManagement', WritingInstructionManagementModal)
registerModal('writingInstructionForm', WritingInstructionFormModal)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LocaleProvider>
        <ThemeProvider>
          <SaveConfirmProvider>
            <ConfirmProvider>
              <ToastProvider>
                <ModalProvider>
                  <App />
                </ModalProvider>
              </ToastProvider>
            </ConfirmProvider>
          </SaveConfirmProvider>
        </ThemeProvider>
      </LocaleProvider>
    </BrowserRouter>
  </StrictMode>,
)
