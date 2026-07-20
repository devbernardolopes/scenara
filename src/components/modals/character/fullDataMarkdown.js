function buildFullDataMarkdown(form, writingInstructionText) {
  const blocks = []

  blocks.push('# Character')
  if (form.name?.trim()) blocks.push(`**Name:** ${form.name.trim()}`)
  if (form.tagline?.trim()) blocks.push(`**Tagline:** ${form.tagline.trim()}`)
  if (form.systemPrompt?.trim()) blocks.push(`**SYSTEM Prompt:**\n\n${form.systemPrompt.trim()}`)
  if (form.prompt?.trim()) blocks.push(`**Character Prompt:**\n\n${form.prompt.trim()}`)
  if (form.personality?.trim()) blocks.push(`**Personality:**\n\n${form.personality.trim()}`)
  if (form.globalContext?.trim())
    blocks.push(`**Global Context/Scenario:**\n\n${form.globalContext.trim()}`)
  if (form.extraPrompt?.trim())
    blocks.push(`**One-time only Extra Prompt:**\n\n${form.extraPrompt.trim()}`)
  if (writingInstructionText?.trim())
    blocks.push(`**Writing Instruction:**\n\n${writingInstructionText.trim()}`)

  const initialMessages = (form.initialMessages || []).filter((m) => m.content?.trim())
  if (initialMessages.length > 0) {
    blocks.push('# Initial Messages')
    initialMessages.forEach((m, idx) => {
      blocks.push(`## Initial Message #${idx + 1}`)
      blocks.push(m.content.trim())
    })
  }

  const scenarios = (form.scenarios || []).filter((s) => s.content?.trim())
  if (scenarios.length > 0) {
    blocks.push('# Scenarios')
    scenarios.forEach((s) => {
      blocks.push(`## ${s.name?.trim() || 'Untitled Scenario'}`)
      blocks.push(s.content.trim())
    })
  }

  const hasSystem = form.summarizationSystemInstructions?.trim()
  const hasUser = form.summarizationUserInstructions?.trim()
  if (form.memory !== 'never' && (hasSystem || hasUser)) {
    blocks.push('# Summarization Prompts')
    if (hasSystem) {
      blocks.push('## SYSTEM Summarization Instructions')
      blocks.push(form.summarizationSystemInstructions.trim())
    }
    if (hasUser) {
      blocks.push('## USER Summarization Instructions')
      blocks.push(form.summarizationUserInstructions.trim())
    }
  }

  return blocks.join('\n\n') + '\n'
}

export { buildFullDataMarkdown }
