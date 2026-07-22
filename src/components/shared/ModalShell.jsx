import CloseButton from './CloseButton'

function ModalShell({ title, onClose, children, footer }) {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between p-6 pb-4 shadow-section shrink-0">
        <h2 className="text-xl font-semibold text-text">{title}</h2>
        {onClose && <CloseButton onClick={onClose} />}
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col p-6 pt-4 min-h-0">{children}</div>
      {footer && (
        <div className="flex justify-end gap-3 px-6 py-4 shadow-section shrink-0">{footer}</div>
      )}
    </div>
  )
}

export default ModalShell
