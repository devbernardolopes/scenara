import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const zlib = require('zlib')

const CHUB_URL_PATTERN =
  /^https?:\/\/(www\.|venus\.)?(chub\.ai|characterhub\.org)\/characters\/(.+?)\/(.+?)(?:\/|\?|#|$)/

function extractPathParts(urlString) {
  try {
    const url = new URL(urlString)
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length >= 3 && parts[0] === 'characters') {
      return { creator: parts[1], name: parts[2] }
    }
  } catch {}
  return null
}

function parsePngChunks(buffer) {
  const chunks = []
  if (buffer.length < 8) return chunks
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== sig[i]) return chunks
  }

  let offset = 8
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd > buffer.length) break

    chunks.push({ type, data: buffer.subarray(dataStart, dataEnd) })
    if (type === 'IEND') break
    offset = dataEnd + 4
  }
  return chunks
}

function extractCharaFromChunks(chunks) {
  for (const chunk of chunks) {
    if (chunk.type === 'tEXt') {
      const nullIdx = chunk.data.indexOf(0)
      if (nullIdx === -1) continue
      const keyword = chunk.data.toString('ascii', 0, nullIdx)
      if (keyword === 'chara') {
        return chunk.data.toString('latin1', nullIdx + 1)
      }
    } else if (chunk.type === 'zTXt') {
      const nullIdx = chunk.data.indexOf(0)
      if (nullIdx === -1) continue
      const keyword = chunk.data.toString('ascii', 0, nullIdx)
      if (keyword === 'chara') {
        const compressionMethod = chunk.data[nullIdx + 1]
        if (compressionMethod !== 0) continue
        const compressed = chunk.data.subarray(nullIdx + 2)
        const decompressed = zlib.inflateSync(compressed)
        return decompressed.toString('utf-8')
      }
    }
  }
  return null
}

async function fetchPngCard(creator, name) {
  const url = `https://avatars.charhub.io/avatars/${creator}/${name}/chara_card_v2.png?nocache=${Date.now()}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Scenara/1' },
  })
  if (!res.ok) return null

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('image/')) return null

  const arrayBuf = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuf)
  const chunks = parsePngChunks(buffer)
  const base64Text = extractCharaFromChunks(chunks)
  if (!base64Text) return null

  const jsonStr = Buffer.from(base64Text, 'base64').toString('utf-8')
  return JSON.parse(jsonStr)
}

async function fetchApiCard(creator, name) {
  const fullPath = `${creator}/${name}`
  const url = `https://gateway.chub.ai/api/characters/${fullPath}?full=true`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Scenara/1' },
  })
  if (!res.ok) return null

  const json = await res.json()
  const def = json?.node?.definition
  if (!def?.name) return null

  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: def.name,
      description: def.description ?? json.node?.description ?? '',
      personality: def.personality || def.tavern_personality || '',
      scenario: def.scenario ?? '',
      first_mes: def.first_message ?? '',
      mes_example: def.example_dialogs ?? '',
      creator_notes: def.creator_notes ?? '',
      system_prompt: def.system_prompt ?? '',
      post_history_instructions: def.post_history_instructions ?? '',
      alternate_greetings: def.alternate_greetings ?? [],
      character_book: def.embedded_lorebook || undefined,
      avatar: json.node?.avatar_url || def.avatar || '',
      tags: json.node?.topics ?? [],
      creator: creator,
      character_version: def.character_version ?? '',
      extensions: {},
    },
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { url } = req.query
  if (!url) {
    res.status(400).json({ error: 'Missing url parameter' })
    return
  }

  if (!CHUB_URL_PATTERN.test(url)) {
    res.status(400).json({ error: 'Unsupported URL. Expected a Chub.ai character URL.' })
    return
  }

  const parts = extractPathParts(url)
  if (!parts) {
    res.status(400).json({ error: 'Could not extract character path from URL' })
    return
  }

  try {
    const [pngResult, apiResult] = await Promise.allSettled([
      fetchPngCard(parts.creator, parts.name),
      fetchApiCard(parts.creator, parts.name),
    ])

    const pngCard = pngResult.status === 'fulfilled' ? pngResult.value : null
    const apiCard = apiResult.status === 'fulfilled' ? apiResult.value : null

    let card = pngCard || apiCard

    if (!card) {
      res.status(404).json({ error: 'Character not found on Chub.ai' })
      return
    }

    if (pngCard && apiCard) {
      const apiAvatar = apiCard.data?.avatar
      if (apiAvatar && /^https?:\/\//.test(apiAvatar)) {
        card.data.avatar = apiAvatar
      }
      const pngGreetings = card.data?.alternate_greetings
      const apiGreetings = apiCard.data?.alternate_greetings
      if ((!pngGreetings || pngGreetings.length === 0) && apiGreetings?.length > 0) {
        card.data.alternate_greetings = apiGreetings
      }
    }

    res.setHeader('Content-Type', 'application/json')
    res.status(200).json(card)
  } catch (err) {
    res.status(502).json({ error: err.message || 'Failed to fetch character from Chub.ai' })
  }
}
