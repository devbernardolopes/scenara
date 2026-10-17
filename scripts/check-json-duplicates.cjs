// Fails when a JSON file contains a duplicate object key.
//
// `JSON.parse` keeps the last of a duplicated key and reports nothing, so a bad
// merge into the hand-maintained `src/locales/en` files passes the build while
// editors flag it as "Duplicate object key". Spotting it needs a raw scan.
//
// Usage: node scripts/check-json-duplicates.cjs [dir...]   (default: src)
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DEFAULT_TARGETS = ['src']

function findJsonFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) findJsonFiles(full, out)
    else if (entry.name.endsWith('.json')) out.push(full)
  }
  return out
}

// Walks the source character by character while tracking object nesting, so a
// string that merely looks like a key (inside an array, or a value) is ignored.
function findDuplicateKeys(source) {
  const stack = []
  const duplicates = []
  let line = 1
  let i = 0

  while (i < source.length) {
    const char = source[i]

    if (char === '\n') {
      line++
      i++
      continue
    }

    if (char === '"') {
      const startLine = line
      let value = ''
      let j = i + 1
      while (j < source.length) {
        const next = source[j]
        if (next === '\\') {
          value += source[j + 1]
          j += 2
          continue
        }
        if (next === '"') break
        if (next === '\n') line++
        value += next
        j++
      }
      i = j + 1

      const frame = stack[stack.length - 1]
      if (frame && frame.type === 'object' && frame.expect === 'key') {
        if (frame.keys.has(value)) {
          duplicates.push({ key: value, first: frame.keys.get(value), line: startLine })
        } else {
          frame.keys.set(value, startLine)
        }
        frame.expect = 'colon'
      }
      continue
    }

    if (char === '{') {
      stack.push({ type: 'object', keys: new Map(), expect: 'key' })
      i++
      continue
    }

    if (char === '[') {
      stack.push({ type: 'array' })
      i++
      continue
    }

    if (char === '}' || char === ']') {
      stack.pop()
      i++
      const frame = stack[stack.length - 1]
      if (frame && frame.type === 'object') frame.expect = 'comma'
      continue
    }

    if (char === ',') {
      const frame = stack[stack.length - 1]
      if (frame && frame.type === 'object') frame.expect = 'key'
      i++
      continue
    }

    if (char === ':') {
      const frame = stack[stack.length - 1]
      if (frame && frame.type === 'object') frame.expect = 'value'
      i++
      continue
    }

    i++
  }

  return duplicates
}

function main() {
  const targets = process.argv.slice(2)
  const resolved = targets.length > 0 ? targets : DEFAULT_TARGETS
  const files = []

  for (const target of resolved) {
    const full = path.resolve(ROOT, target)
    if (!fs.existsSync(full)) continue
    const stat = fs.statSync(full)
    if (stat.isDirectory()) findJsonFiles(full, files)
    else if (full.endsWith('.json')) files.push(full)
  }

  const failures = []
  for (const file of files) {
    for (const dup of findDuplicateKeys(fs.readFileSync(file, 'utf-8'))) {
      failures.push(
        `${path.relative(ROOT, file)}:${dup.line} Duplicate object key "${dup.key}" (first defined at line ${dup.first})`,
      )
    }
  }

  if (failures.length === 0) return

  console.error('Duplicate object keys found (JSON keeps only the last occurrence):\n')
  for (const failure of failures) console.error(`  ${failure}`)
  console.error(`\n${failures.length} duplicate key${failures.length === 1 ? '' : 's'}.`)
  process.exit(1)
}

main()
