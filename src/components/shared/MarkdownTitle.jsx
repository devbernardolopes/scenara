import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getSetting } from '../../services/settings'

const BLOCK_ELEMENTS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'img',
  'div',
  'a',
]

function MarkdownTitle({ children }) {
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    let mounted = true
    getSetting('renderMarkdown').then((v) => {
      if (mounted) setEnabled(v !== false)
    })
    function handler(e) {
      if (e.detail?.key === 'renderMarkdown') setEnabled(e.detail.value !== false)
    }
    window.addEventListener('settings-changed', handler)
    return () => {
      mounted = false
      window.removeEventListener('settings-changed', handler)
    }
  }, [])

  if (!enabled) return <>{children}</>

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      disallowedElements={BLOCK_ELEMENTS}
      unwrapDisallowed
      components={{
        p: ({ children }) => <>{children}</>,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

export default MarkdownTitle
