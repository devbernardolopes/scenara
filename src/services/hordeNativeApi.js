import { getSetting } from './settings'
import { replaceVars } from './chatApi'

const HORDE_BASE_URL = 'https://aihorde.net/api/v2'
const CLIENT_AGENT = 'scenara:1.0:contact'

export const HORDE_PROMPT_TEMPLATES = {
  'simple-roleplay': `{{system}}
---
{{#history}}
{{speaker}}: {{content}}

{{/history}}
{{charName}}:`,

  bracketed: `[System: {{system}}]

{{#history}}
{{speaker}}: {{content}}

{{/history}}
{{charName}}:`,

  chatml: `<|im_start|>system
{{system}}<|im_end|>
{{#history}}
<|im_start|>{{role}}
{{content}}<|im_end|>
{{/history}}
<|im_start|>assistant`,
}

function parseSamplerOrder(val) {
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    const parts = val
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n))
    return parts.length > 0 ? parts : null
  }
  return null
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export function renderHordeNativePrompt({ messages, template, charName, personaName }) {
  if (!messages || !Array.isArray(messages)) return ''

  const resolvedTemplate =
    template && template !== 'custom' && HORDE_PROMPT_TEMPLATES[template]
      ? HORDE_PROMPT_TEMPLATES[template]
      : template || HORDE_PROMPT_TEMPLATES['simple-roleplay']

  const systemEntries = messages.filter((m) => m.role === 'system')
  const historyEntries = messages.filter((m) => m.role !== 'system')

  const systemBlock = systemEntries
    .map((m) => m.content || '')
    .filter(Boolean)
    .join('\n\n')

  const history = historyEntries.map((m) => ({
    content: m.content || '',
    role: m.role || '',
    speaker:
      m.role === 'assistant'
        ? charName || 'Assistant'
        : m.role === 'user'
          ? personaName || 'User'
          : 'System',
  }))

  let result = resolvedTemplate

  result = result.replace(/\{\{#history\}\}([\s\S]*?)\{\{\/history\}\}/g, (_, block) => {
    return history
      .map((msg) =>
        block
          .replace(/\{\{speaker\}\}/g, msg.speaker)
          .replace(/\{\{content\}\}/g, msg.content)
          .replace(/\{\{role\}\}/g, msg.role),
      )
      .join('')
  })

  result = result
    .replace(/\{\{system\}\}/g, systemBlock)
    .replace(/\{\{charName\}\}/g, charName || 'Assistant')
    .replace(/\{\{personaName\}\}/g, personaName || 'User')
    .replace(/\{\{assistantName\}\}/g, charName || 'Assistant')

  return result
}

export function getHordeNativeParams(profile) {
  const params = profile?.params || {}
  const native = {
    max_length: params.max_length ?? 256,
    max_context_length: params.max_context_length ?? 2048,
    temperature: params.temperature ?? 0.75,
    top_p: params.top_p ?? 1,
    top_k: params.top_k ?? 0,
    top_a: params.top_a ?? 0,
    tfs: params.tfs ?? 1,
    typical: params.typical ?? 1,
    min_p: params.min_p ?? 0.01,
    smoothing_factor: params.smoothing_factor ?? 0,
    repetition_penalty: params.repetition_penalty ?? 1.1,
    sampler_order: parseSamplerOrder(params.sampler_order) ?? [6, 0, 1, 2, 3, 4, 5],
    n: params.n ?? 1,
  }
  return Object.fromEntries(Object.entries(native).filter(([, v]) => v != null && v !== ''))
}

function getHordeNativeRequestOptions(profile) {
  const params = profile?.params || {}
  const options = {}
  if (params.trusted_workers != null) options.trusted_workers = params.trusted_workers
  if (params.slow_workers != null) options.slow_workers = params.slow_workers
  if (params.allow_downgrade != null) options.allow_downgrade = params.allow_downgrade
  if (params.disable_batching != null) options.disable_batching = params.disable_batching
  if (params.dry_run != null) options.dry_run = params.dry_run
  return options
}

function extractErrorDetail(errBody) {
  if (!errBody) return ''
  try {
    const parsed = JSON.parse(errBody)
    if (typeof parsed === 'string') return parsed
    if (parsed.message) return parsed.message
    if (parsed.error) {
      if (typeof parsed.error === 'string') return parsed.error
      if (parsed.error.message) return parsed.error.message
    }
  } catch {
    /* not JSON, use raw */
  }
  return errBody
}

async function logApiCall({
  profile,
  requestBody,
  responseBody,
  status,
  durationMs,
  error,
  threadId,
  kind,
}) {
  try {
    const { addLog } = await import('../services/logs')
    await addLog({
      type: 'api',
      threadId,
      kind,
      level: status === 'error' ? 'error' : 'info',
      providerId: profile.providerId,
      model: profile.model || null,
      request: requestBody,
      response: responseBody,
      status,
      durationMs,
      error: error || null,
    })
  } catch {
    /* logging non-critical */
  }
}

export async function sendHordeNativeCompletion({
  prompt,
  profile,
  signal,
  onToken,
  onFinish,
  onStreamingStarted,
  onActivity,
  onTiming,
  threadId = null,
  kind = null,
  stopSequences = null,
}) {
  if (!prompt) {
    return { content: '', response: null }
  }

  const apiKey = profile?.key
  const baseUrl = profile?.baseUrl?.replace(/\/+$/, '') || HORDE_BASE_URL
  const generationParams = getHordeNativeParams(profile)
  const requestOptions = getHordeNativeRequestOptions(profile)

  if (stopSequences?.length) {
    generationParams.stop_sequence = stopSequences
  }

  const body = {
    prompt,
    params: generationParams,
    models: [profile?.model].filter(Boolean),
    ...requestOptions,
  }

  const startedAt = performance.now()
  let timingReported = false
  const reportTiming = () => {
    if (timingReported) return
    timingReported = true
    onTiming?.(Math.round(performance.now() - startedAt))
  }

  let apiError = null
  let status = 'success'
  let responseBody = null
  let requestBody = null

  try {
    requestBody = body
    const headers = {
      'Content-Type': 'application/json',
      'Client-Agent': CLIENT_AGENT,
    }
    if (apiKey) headers['apikey'] = apiKey

    const submitRes = await fetch(`${baseUrl}/generate/text/async`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })

    if (!submitRes.ok) {
      const errBody = await submitRes.text().catch(() => '')
      throw new Error(extractErrorDetail(errBody) || `HTTP ${submitRes.status}`)
    }

    const { id } = await submitRes.json()
    if (!id) throw new Error('No job ID returned by Horde')

    while (true) {
      if (signal?.aborted) {
        await cancelHordeJob(id, apiKey, baseUrl)
        throw new DOMException('Aborted', 'AbortError')
      }

      await sleep(2000)
      onActivity?.()

      const statusRes = await fetch(`${baseUrl}/generate/text/status/${id}`, {
        headers: { 'Client-Agent': CLIENT_AGENT },
        signal,
      })

      if (!statusRes.ok) {
        const errBody = await statusRes.text().catch(() => '')
        throw new Error(extractErrorDetail(errBody) || `HTTP ${statusRes.status}`)
      }

      const json = await statusRes.json()
      responseBody = json

      if (json.faulted) {
        throw new Error(json.generations?.[0]?.text || 'Generation faulted on Horde worker')
      }

      if (json.done) {
        const content = json.generations?.[0]?.text || ''
        onStreamingStarted?.()
        onToken?.(content)
        onFinish?.('stop')
        reportTiming()
        return { content, response: json }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw err
    }
    apiError = err
    status = 'error'
    throw err
  } finally {
    if (!timingReported) reportTiming()
    const durationMs = Math.round(performance.now() - startedAt)
    logApiCall({
      profile,
      requestBody,
      responseBody,
      status,
      durationMs,
      error: apiError?.message,
      threadId,
      kind,
    })
  }
}

async function cancelHordeJob(id, apiKey, baseUrl) {
  try {
    const headers = { 'Client-Agent': CLIENT_AGENT }
    if (apiKey) headers['apikey'] = apiKey
    await fetch(`${baseUrl}/generate/text/status/${id}`, {
      method: 'DELETE',
      headers,
    })
  } catch {
    /* cleanup best-effort */
  }
}

export async function sendHordeNativeChatCompletion({
  profile,
  messages,
  signal,
  charName,
  personaName,
  onToken,
  onFinish,
  onStreamingStarted,
  onActivity,
  onTiming,
  threadId = null,
  kind = null,
}) {
  const templateName = (await getSetting('hordeNativePromptTemplate')) || 'simple-roleplay'
  let templateString = templateName
  if (templateName !== 'custom') {
    templateString =
      HORDE_PROMPT_TEMPLATES[templateName] || HORDE_PROMPT_TEMPLATES['simple-roleplay']
  } else {
    templateString = await getSetting('hordeNativePromptCustomTemplate')
    if (!templateString?.trim()) {
      templateString = HORDE_PROMPT_TEMPLATES['simple-roleplay']
    }
  }

  const prompt = renderHordeNativePrompt({
    messages,
    template: templateString,
    charName,
    personaName,
  })

  const stop = profile?.params?.stop
  let stopSequences = null
  if (Array.isArray(stop) && stop.length > 0) {
    stopSequences = stop.map((s) =>
      replaceVars(s, { charName, personaName, currentPersonaName: personaName }),
    )
  }

  return sendHordeNativeCompletion({
    prompt,
    profile,
    signal,
    onToken,
    onFinish,
    onStreamingStarted,
    onActivity,
    onTiming,
    threadId,
    kind,
    stopSequences,
  })
}
