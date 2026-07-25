import { findCodeRanges } from './postProcessing'
import { stripOOCDelimiters } from '../services/chatApi'

const SPEAKER_PREFIX_RE = /^\s*[^:[\]()\n]{1,40}\s*:\s*/gm

function stripCodeBlocks(text) {
  if (!text) return ''
  const ranges = findCodeRanges(text)
  if (!ranges.length) return text
  let result = ''
  let cursor = 0
  for (const [start, end] of ranges) {
    result += text.slice(cursor, start)
    cursor = end
  }
  result += text.slice(cursor)
  return result
}

function stripRPDelimiters(text) {
  return text.replace(/\*([^*\n]+)\*/g, '$1').replace(/_([^_\n]+)_/g, '$1')
}

function stripMarkdown(text) {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*{1,2}([^*\n]+)\*{1,2}/g, '$1')
    .replace(/_{1,2}([^_\n]+)_{1,2}/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
}

function stripSpeakerPrefixes(text) {
  return text
    .split('\n')
    .map((line) => line.replace(SPEAKER_PREFIX_RE, ''))
    .join('\n')
}

export function prepareTtsText(message, context) {
  if (!message?.content) return ''
  let text = message.content

  text = stripCodeBlocks(text)

  if (message.isOOC && context?.oocDelimiters) {
    text = stripOOCDelimiters(text, context.oocDelimiters)
  }

  text = stripRPDelimiters(text)
  text = stripMarkdown(text)
  text = stripSpeakerPrefixes(text)
  text = text.replace(/\s+/g, ' ').trim()

  return text
}
