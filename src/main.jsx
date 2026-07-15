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
import ProfileManagementModal from './components/modals/ProfileManagementModal'
import ProfileFormModal from './components/modals/ProfileFormModal'
import InChatShortcutManagementModal from './components/modals/InChatShortcutManagementModal'
import InChatShortcutFormModal from './components/modals/InChatShortcutFormModal'
import ShowPromptModal from './components/modals/ShowPromptModal'
import RequestDetailsModal from './components/modals/RequestDetailsModal'
import DirectorDetailsModal from './components/modals/DirectorDetailsModal'
import MemoryModal from './components/modals/MemoryModal'
import MemoryRegenerationModal from './components/modals/MemoryRegenerationModal'
import MemoryRegenerationResultModal from './components/modals/MemoryRegenerationResultModal'
import TagManagementModal from './components/modals/TagManagementModal'
import LocalInferenceModal from './components/modals/LocalInferenceModal'
import CancelConfirmModal from './components/modals/CancelConfirmModal'
import ProgressModal from './components/modals/ProgressModal'

const SettingsModal = lazy(() => import('./components/modals/settings/SettingsModal'))
const ImageViewerModal = lazy(() => import('./components/modals/ImageViewerModal'))
const ExportDatabaseModal = lazy(() => import('./components/modals/ExportDatabaseModal'))

registerModal('settings', SettingsModal)
registerModal('imageViewer', ImageViewerModal)
registerModal('characterCreate', CharacterCreateModal)
registerModal('personaEditor', PersonaEditorModal)
registerModal('personaForm', PersonaFormModal)
registerModal('personaManagement', PersonaManagementModal)
registerModal('editThreadTitle', EditThreadTitleModal)
registerModal('writingInstructionManagement', WritingInstructionManagementModal)
registerModal('writingInstructionForm', WritingInstructionFormModal)
registerModal('profileManagement', ProfileManagementModal)
registerModal('profileForm', ProfileFormModal)
registerModal('inChatShortcutManagement', InChatShortcutManagementModal)
registerModal('inChatShortcutForm', InChatShortcutFormModal)
registerModal('showPrompt', ShowPromptModal)
registerModal('requestDetails', RequestDetailsModal)
registerModal('directorDetails', DirectorDetailsModal)
registerModal('memory', MemoryModal)
registerModal('memoryRegeneration', MemoryRegenerationModal)
registerModal('memoryRegenerationResult', MemoryRegenerationResultModal)
registerModal('tagManagement', TagManagementModal)
registerModal('localInference', LocalInferenceModal)
registerModal('cancelConfirm', CancelConfirmModal)
registerModal('progress', ProgressModal)
registerModal('exportDatabase', ExportDatabaseModal)

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
