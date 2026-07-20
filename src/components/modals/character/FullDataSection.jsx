import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { showToast } from '../../../lib/toast'
import { getWritingInstruction } from '../../../services/writingInstructions'
import AutoResizeTextarea from '../../shared/AutoResizeTextarea'

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

export default function FullDataSection({ form }) {
  const { t } = useTranslation('characterCreation')
  const [writingInstructionText, setWritingInstructionText] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!form.writingInstruction) {
      setWritingInstructionText('')
      return
    }
    getWritingInstruction(form.writingInstruction).then((wi) => {
      if (!cancelled) setWritingInstructionText(wi ? `${wi.name}\n\n${wi.content}` : '')
    })
    return () => {
      cancelled = true
    }
  }, [form.writingInstruction])

  const markdown = useMemo(
    () => buildFullDataMarkdown(form, writingInstructionText),
    [form, writingInstructionText],
  )

  function handleCopy() {
    if (!markdown) return
    navigator.clipboard
      .writeText(markdown)
      .then(() => showToast(t('common:toast.copied'), { type: 'success' }))
      .catch(() => {})
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleCopy}
          className="min-h-[44px] px-4 text-sm rounded-md border border-border bg-surface hover:bg-surface-hover text-secondary"
        >
          {t('copyToClipboard')}
        </button>
      </div>
      <AutoResizeTextarea
        readOnly
        value={markdown}
        className="w-full p-3 border border-border rounded-md bg-surface text-text text-sm resize-none focus:outline-none cursor-default font-mono"
        extraHeight={8}
      />
    </div>
  )
}
