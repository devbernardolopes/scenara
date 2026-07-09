import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
