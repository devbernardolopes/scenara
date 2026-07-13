/**
 * @typedef {Object} PPRule
 * @property {string} id
 * @property {string} [label]
 * @property {string[]} openChars   // one or more literal strings, e.g. ["\"", "“"]
 * @property {string[]} closeChars  // one or more literal strings, e.g. ["\"", "”"]
 * @property {string} color         // CSS color value
 * @property {number} fontSizePercent // 50-150
 */

export const DEFAULT_PP_RULES = [
  {
    id: 'preset-narration',
    label: 'Narration',
    openChars: ['*', '_'],
    closeChars: ['*', '_'],
    color: '#6b7280',
    fontSizePercent: 95,
  },
  {
    id: 'preset-dialogue',
    label: 'Dialogue',
    openChars: ['"', '\u201c', '\u2018', '*"'],
    closeChars: ['"', '\u201d', '\u2019', '"*'],
    color: '#eab308',
    fontSizePercent: 125,
  },
]

function buildInCode(text, ranges) {
  const arr = new Uint8Array(text.length)
  for (const [s, e] of ranges) {
    for (let i = s; i < e && i < text.length; i++) arr[i] = 1
  }
  return (i) => i >= 0 && i < arr.length && arr[i] === 1
}

/**
 * Single-pass, stack-depth-1 scanner. Returns an array of segments:
 * `{ type: 'text', content }` | `{ type: 'styled', ruleIndex, content, start, end }`.
 * The delimiters are included in the styled segment so they stay visible.
 *
 * @param {string} text
 * @param {PPRule[]} rules
 * @param {Array<[number, number]>} [codeRanges] indices to skip (opaque)
 * @returns {Array}
 */
function scan(text, rules, codeRanges) {
  const segments = []
  if (!text) return segments
  const n = text.length
  const inCode = codeRanges ? buildInCode(text, codeRanges) : null

  let i = 0
  let segStart = -1
  let activeRule = -1
  let pendingTextStart = 0

  const flushText = (end) => {
    if (end > pendingTextStart) {
      segments.push({ type: 'text', content: text.slice(pendingTextStart, end) })
    }
  }

  while (i < n) {
    if (inCode && inCode(i)) {
      // Opaque region: never start/stop a rule here.
      activeRule = -1
      i++
      continue
    }

    if (activeRule === -1) {
      // Test every rule's openChars; pick longest match, ties by rule order.
      let best = null
      for (let r = 0; r < rules.length; r++) {
        const openChars = rules[r].openChars || []
        for (const open of openChars) {
          if (!open) continue
          if (text.startsWith(open, i)) {
            const len = open.length
            if (!best || len > best.len || (len === best.len && r < best.ruleIndex)) {
              best = { ruleIndex: r, len }
            }
          }
        }
      }
      // Word-boundary guard: skip if preceded by an alphanumeric character.
      if (best && i > 0) {
        const prev = text.charCodeAt(i - 1)
        const isAlphaNum =
          (prev >= 0x30 && prev <= 0x39) || // 0-9
          (prev >= 0x41 && prev <= 0x5a) || // A-Z
          (prev >= 0x61 && prev <= 0x7a) // a-z
        if (isAlphaNum) best = null
      }
      if (best) {
        flushText(i)
        segStart = i
        activeRule = best.ruleIndex
        i += best.len
        pendingTextStart = i
      } else {
        i++
      }
    } else {
      // Only test the active rule's own closeChars (outermost wins).
      const closeChars = rules[activeRule].closeChars || []
      let close = null
      for (const c of closeChars) {
        if (!c) continue
        if (text.startsWith(c, i)) {
          const len = c.length
          if (!close || len > close.len) close = { len }
        }
      }
      if (close) {
        const end = i + close.len
        segments.push({
          type: 'styled',
          ruleIndex: activeRule,
          content: text.slice(segStart, end),
          start: segStart,
          end,
        })
        i = end
        activeRule = -1
        segStart = -1
        pendingTextStart = i
      } else {
        i++
      }
    }
  }

  if (activeRule !== -1) {
    // Truncated generation: implicit close at EOF.
    segments.push({
      type: 'styled',
      ruleIndex: activeRule,
      content: text.slice(segStart, n),
      start: segStart,
      end: n,
    })
  } else {
    flushText(n)
  }
  return segments
}

export function scanText(text, rules) {
  return scan(text, rules, null)
}

/**
 * Lightweight code-range detector for the Markdown-on path.
 * Fenced blocks (``` or ~~~) and inline backtick runs are treated as opaque.
 *
 * @param {string} markdownText
 * @returns {Array<[number, number]>}
 */
export function findCodeRanges(md) {
  const ranges = []
  const lines = md.split('\n')
  let offset = 0
  let fence = null // { char, count, start }

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    const lineStart = offset
    const trimmed = line.trimStart()

    if (fence) {
      const closeRe = new RegExp('^' + fence.char + '{' + fence.count + ',}\\s*$')
      if (closeRe.test(trimmed)) {
        ranges.push([fence.start, lineStart + line.length + 1])
        fence = null
      }
    } else {
      const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/)
      if (fenceMatch) {
        fence = {
          char: fenceMatch[1][0],
          count: fenceMatch[1].length,
          start: lineStart,
        }
      } else {
        scanInlineCode(line, lineStart, ranges)
      }
    }
    offset += line.length + 1
  }
  if (fence) ranges.push([fence.start, offset])
  return ranges
}

function scanInlineCode(line, lineStart, ranges) {
  let i = 0
  while (i < line.length) {
    if (line[i] === '`') {
      let openLen = 0
      while (i + openLen < line.length && line[i + openLen] === '`') openLen++
      let j = i + openLen
      let found = false
      while (j < line.length) {
        if (line[j] === '`') {
          let closeLen = 0
          while (j + closeLen < line.length && line[j + closeLen] === '`') closeLen++
          if (closeLen === openLen) {
            ranges.push([lineStart + i, lineStart + j + closeLen])
            i = j + closeLen
            found = true
            break
          }
          j += closeLen
        } else {
          j++
        }
      }
      if (!found) break
    } else {
      i++
    }
  }
}

export function applyRulesToPlainText(text, rules) {
  return scanText(text, rules)
}

/**
 * For the Markdown-on path: wrap each matched span in `<pp r="RULE_INDEX">…</pp>`
 * so it survives rehype-raw + rehype-sanitize and is styled by the `pp` component.
 *
 * @param {string} markdownText
 * @param {PPRule[]} rules
 * @returns {string}
 */
export function injectRuleTags(md, rules) {
  const codeRanges = findCodeRanges(md)
  const segments = scan(md, rules, codeRanges)
  let out = ''
  let pos = 0
  for (const seg of segments) {
    if (seg.type === 'styled') {
      out += md.slice(pos, seg.start)
      out += `<pp r="${seg.ruleIndex}">${seg.content}</pp>`
      pos = seg.end
    }
  }
  out += md.slice(pos)
  return out
}
