import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeRaw from 'rehype-raw'
import { ChevronDown, ChevronUp, Copy } from '../../lib/icons'
import { showToast } from '../../lib/toast'

function handleCodeCopy(codeContent) {
  if (!codeContent) return
  navigator.clipboard
    .writeText(codeContent.trim())
    .then(() => showToast('Code copied!', { type: 'success' }))
    .catch(() => showToast('Failed to copy', { type: 'error' }))
}

function CodeBlockWrapperBase({ collapsed, onToggle, codeText, children }) {
  return (
    <div className="relative group">
      <pre
        className={`bg-code border border-border rounded-md my-2 overflow-x-auto max-w-full break-words pr-16 transition-all duration-150 ${
          collapsed ? 'max-h-12 overflow-y-hidden whitespace-pre p-2' : 'whitespace-pre-wrap p-3'
        }`}
      >
        {children}
      </pre>

      <button
        onClick={onToggle}
        className="absolute top-2 left-2 p-1.5 rounded bg-surface/90 hover:bg-surface text-tertiary hover:text-text border border-border transition-all active:scale-95 focus:opacity-100"
        title={collapsed ? 'Expand code block' : 'Collapse code block'}
        aria-label={collapsed ? 'Expand code block' : 'Collapse code block'}
      >
        {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {codeText && (
        <button
          onClick={() => handleCodeCopy(codeText)}
          className="absolute top-2 right-2 p-1.5 rounded bg-surface/90 hover:bg-surface text-tertiary hover:text-text border border-border transition-all active:scale-95 focus:opacity-100"
          title="Copy code"
          aria-label="Copy code"
        >
          <Copy className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export const CodeBlockWrapper = memo(CodeBlockWrapperBase)

const PP_SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'pp'],
  attributes: {
    ...defaultSchema.attributes,
    pp: ['r'],
  },
}

function CodeBlocksMarkdownBase({
  content,
  activeRules,
  collapsedCodeBlocks,
  onToggleCodeBlock,
  messageId,
}) {
  let blockIndex = 0

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, PP_SANITIZE_SCHEMA]]}
      components={{
        pp: ({ r, children }) => {
          const rule = activeRules[Number(r)]
          if (!rule) return <>{children}</>
          return (
            <span style={{ color: rule.color, fontSize: `${rule.fontSizePercent}%` }}>
              {children}
            </span>
          )
        },
        p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
        code: ({ children, className }) => (
          <code
            className={`font-mono text-[0.85em] px-1.5 py-0.5 rounded bg-code border border-border ${className || ''} break-words`}
          >
            {children}
          </code>
        ),
        pre: ({ children }) => {
          const myIndex = blockIndex++
          let codeText = ''

          if (typeof children === 'string') {
            codeText = children
          } else if (children && children.props && children.props.children) {
            const inner = children.props.children
            codeText =
              typeof inner === 'string'
                ? inner
                : Array.isArray(inner)
                  ? inner.join('')
                  : String(inner || '')
          } else if (Array.isArray(children)) {
            codeText = children
              .map((c) => (typeof c === 'string' ? c : c?.props?.children || ''))
              .join('')
          }

          const isCollapsed = collapsedCodeBlocks?.includes(myIndex) ?? false

          return (
            <CodeBlockWrapper
              collapsed={isCollapsed}
              onToggle={() => onToggleCodeBlock?.(messageId, myIndex)}
              codeText={codeText}
            >
              {children}
            </CodeBlockWrapper>
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export const CodeBlocksMarkdown = memo(CodeBlocksMarkdownBase)
