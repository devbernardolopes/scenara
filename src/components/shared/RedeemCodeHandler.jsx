import { useEffect, useRef } from 'react'
import { useModal } from '../../hooks/useModal'
import { redeemCode } from '../../services/codeRedemption'

function RedeemCodeHandler() {
  const { openModal } = useModal()
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const params = new URLSearchParams(window.location.search)
    const code = (params.get('code') || '').trim()
    if (!code) return

    function cleanUrl() {
      const url = new URL(window.location.href)
      url.searchParams.delete('code')
      window.history.replaceState({}, '', url)
    }

    redeemCode(code)
      .then((summary) => {
        cleanUrl()
        openModal('redeemCodeResult', { status: 'success', code: summary.code, summary })
      })
      .catch((err) => {
        cleanUrl()
        openModal('redeemCodeResult', { status: 'error', code, error: err?.code || 'invalid' })
      })
  }, [openModal])

  return null
}

export default RedeemCodeHandler
