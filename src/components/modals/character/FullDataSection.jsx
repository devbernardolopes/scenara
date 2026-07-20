import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { showToast } from '../../../lib/toast'
import { getWritingInstruction } from '../../../services/writingInstructions'
import AutoResizeTextarea from '../../shared/AutoResizeTextarea'
import { buildFullDataMarkdown } from './fullDataMarkdown'

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
