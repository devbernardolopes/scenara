const BASE_URLS = {
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  'ai-horde': 'https://oai.aihorde.net',
}

export function getChatBaseUrl(providerId) {
  return BASE_URLS[providerId] || null
}

export function replaceVars(text, { charName, personaName, currentPersonaName }) {
  if (!text) return text
  return text
    .replace(/{{char}}/g, charName || '')
    .replace(/{{user}}/g, personaName || '')
    .replace(/{{name}}/g, currentPersonaName || personaName || '')
}

export async function buildMessagesPayload({
  character,
  chatPersona,
  currentPersona,
  messages,
  isFirstMessage,
  settings,
  writingInstruction,
}) {
  const systemParts = []

  const charName = character?.name || ''
  const personaName = chatPersona?.name || ''
  const currentPersonaName = currentPersona?.name || personaName

  const replaceVarsIn = (text) => replaceVars(text, { charName, personaName, currentPersonaName })

  const replaceVarsWithDesc = (text) => {
    if (!text) return text
    const desc = chatPersona?.description || ''
    return replaceVarsIn(text).replace(/{{description}}/g, desc)
  }

  const prompt = replaceVarsIn(character?.prompt)
  if (prompt) systemParts.push(prompt)

  const extraPrompt = replaceVarsIn(character?.extraPrompt)
  if (isFirstMessage && extraPrompt) systemParts.push(extraPrompt)

  if (writingInstruction?.content && character?.writingPlacement === 'endOfSystemPrompt') {
    systemParts.push(writingInstruction.content)
  }

  const personaTemplate = replaceVarsWithDesc(settings.personaInjectionTemplate)
  if (personaTemplate && character?.personaInjectionPlacement === 'endOfSystemPrompt') {
    systemParts.push(personaTemplate)
  }

  const result = [{ role: 'system', content: systemParts.join('\n\n') }]

  if (isFirstMessage) {
    const firstMessageContent = replaceVarsIn(settings.firstMessagePrompt)
    const firstMessageRole = settings.firstMessageRole || 'system'
    if (firstMessageContent) {
      result.push({ role: firstMessageRole, content: firstMessageContent })
    }
  } else {
    for (const msg of messages) {
      result.push({ role: msg.role, content: msg.content })
    }

    const lastMsg = messages[messages.length - 1]
    const continuePrompt = replaceVarsIn(settings.continuePrompt)
    const continueRole = settings.continueRole || 'user'
    if (lastMsg && lastMsg.role !== 'user' && continuePrompt) {
      result.push({ role: continueRole, content: continuePrompt })
    }
  }

  return result
}

export async function sendChatCompletion({ profile, messages, signal, onToken }) {
  const baseUrl = getChatBaseUrl(profile.providerId)
  if (!baseUrl) throw new Error(`No base URL for provider "${profile.providerId}"`)

  const headers = { 'Content-Type': 'application/json' }
  if (profile.key) headers['Authorization'] = `Bearer ${profile.key}`

  const body = {
    model: profile.model,
    messages,
    ...profile.params,
  }

  if (profile.params.stream) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}${errBody ? `: ${errBody}` : ''}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const choice = parsed.choices?.[0]
          if (choice?.delta?.content) {
            fullContent += choice.delta.content
            onToken?.(fullContent)
          }
          if (choice?.finish_reason) {
            // generation finished
          }
        } catch {
          // skip unparseable chunks
        }
      }
    }

    return fullContent
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${errBody ? `: ${errBody}` : ''}`)
  }

  const json = await res.json()
  const content = json.choices?.[0]?.message?.content || ''
  return content
}
