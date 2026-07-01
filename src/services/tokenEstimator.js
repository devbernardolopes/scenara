import { encode } from 'gpt-tokenizer'

export function estimateTokens(text) {
  if (!text) return 0
  return encode(text).length
}
