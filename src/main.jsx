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
import { addLog } from './services/logs'

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
import MakeShortcutModal from './components/modals/MakeShortcutModal'
import ShowPromptModal from './components/modals/ShowPromptModal'
import RequestDetailsModal from './components/modals/RequestDetailsModal'
import DirectorDetailsModal from './components/modals/DirectorDetailsModal'
import DirectorRegenerationResultModal from './components/modals/DirectorRegenerationResultModal'
import MemoryModal from './components/modals/MemoryModal'
import MemoryRegenerationModal from './components/modals/MemoryRegenerationModal'
import MemoryRegenerationResultModal from './components/modals/MemoryRegenerationResultModal'
import TagManagementModal from './components/modals/TagManagementModal'
import LocalInferenceModal from './components/modals/LocalInferenceModal'
import CancelConfirmModal from './components/modals/CancelConfirmModal'
import AutoTitleCancelModal from './components/modals/AutoTitleCancelModal'
import SummaryCancelModal from './components/modals/SummaryCancelModal'
import ProgressModal from './components/modals/ProgressModal'
import ImportSourceModal from './components/modals/ImportSourceModal'
import LogsModal from './components/modals/LogsModal'
import LogDetailsModal from './components/modals/LogDetailsModal'

const SettingsModal = lazy(() => import('./components/modals/settings/SettingsModal'))
const ImageViewerModal = lazy(() => import('./components/modals/ImageViewerModal'))
const ExportDatabaseModal = lazy(() => import('./components/modals/ExportDatabaseModal'))
const ScenarioSelectorModal = lazy(() => import('./components/modals/ScenarioSelectorModal'))

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
registerModal('makeShortcut', MakeShortcutModal)
registerModal('showPrompt', ShowPromptModal)
registerModal('requestDetails', RequestDetailsModal)
registerModal('directorDetails', DirectorDetailsModal)
registerModal('directorRegenerationResult', DirectorRegenerationResultModal)
registerModal('memory', MemoryModal)
registerModal('memoryRegeneration', MemoryRegenerationModal)
registerModal('memoryRegenerationResult', MemoryRegenerationResultModal)
registerModal('tagManagement', TagManagementModal)
registerModal('localInference', LocalInferenceModal)
registerModal('cancelConfirm', CancelConfirmModal)
registerModal('autoTitleCancel', AutoTitleCancelModal)
registerModal('summaryCancel', SummaryCancelModal)
registerModal('progress', ProgressModal)
registerModal('exportDatabase', ExportDatabaseModal)
registerModal('scenarioSelector', ScenarioSelectorModal)
registerModal('importSource', ImportSourceModal)
registerModal('logs', LogsModal)
registerModal('logDetails', LogDetailsModal)

// Global log capture (no per-call wiring needed).
// Toast logs are captured centrally inside ToastProvider.addToast so that
// every toast is recorded regardless of the call path.
window.addEventListener('error', (e) => {
  const msg = e?.message || (e?.error && e.error.message) || 'Unknown error'
  const stack = e?.error?.stack
  addLog({ type: 'error', level: 'error', message: msg, error: stack || null })
})

window.addEventListener('unhandledrejection', (e) => {
  const reason = e?.reason
  const msg =
    reason?.message || (typeof reason === 'string' ? reason : 'Unhandled promise rejection')
  const stack = reason?.stack
  addLog({ type: 'error', level: 'error', message: msg, error: stack || null })
})

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
