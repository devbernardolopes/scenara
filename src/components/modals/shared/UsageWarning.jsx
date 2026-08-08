import Avatar from '../../shared/Avatar'

// Compact summary block for batch-delete confirms: a heading plus one
// pre-formatted line per item in use.
export function CompactBlock({ heading, lines }) {
  if (!lines || lines.length === 0) return null
  return (
    <div className="text-sm text-secondary mb-4">
      <p>{heading}</p>
      <ul className="list-disc pl-5 mt-1 space-y-0.5">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  )
}

// Detailed linked-character list for single-delete confirms.
export function CharacterRows({ title, characters }) {
  return (
    <div className="mb-6">
      <p className="text-sm text-secondary mb-3">{title}</p>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {characters.map((char) => (
          <div
            key={char.id}
            className="flex items-center gap-3 p-2 rounded-md bg-surface-secondary"
          >
            <Avatar src={char.avatar} size="md" />
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-sm font-medium text-text truncate">{char.name}</span>
              <span className="text-xs text-tertiary shrink-0">#{char.characterNumber}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Detailed linked-thread list for single-delete confirms.
export function ThreadRows({ title, threads }) {
  return (
    <div className="mb-6">
      <p className="text-sm text-secondary mb-3">{title}</p>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {threads.map((t) => (
          <div key={t.id} className="p-2 rounded-md bg-surface-secondary">
            <span className="text-sm text-text truncate">{t.title || `#${t.threadNumber}`}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
