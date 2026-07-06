import { useState, useEffect, useRef } from 'react'
import { getTotalUnread, clearUnread, initBroadcastChannel } from '../services/unread'
import { setUnreadCount } from '../services/titleManager'

export function useUnread() {
  const [totalUnread, setTotalUnread] = useState(0)
  const cleanupRef = useRef(null)

  useEffect(() => {
    async function refresh() {
      const total = await getTotalUnread()
      setTotalUnread(total)
      setUnreadCount(total)
    }

    refresh()

    window.addEventListener('threads-changed', refresh)
    window.addEventListener('unread-changed', refresh)

    cleanupRef.current = initBroadcastChannel(() => refresh())

    return () => {
      window.removeEventListener('threads-changed', refresh)
      window.removeEventListener('unread-changed', refresh)
      cleanupRef.current?.()
    }
  }, [])

  return { totalUnread }
}

export function useClearUnreadOnScroll(threadId, scrollRef) {
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    function checkScroll() {
      if (!el) return
      const threshold = 100
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
      if (isAtBottom) {
        clearUnread(threadId)
      }
    }

    el.addEventListener('scroll', checkScroll, { passive: true })
    return () => el.removeEventListener('scroll', checkScroll)
  }, [threadId, scrollRef])
}
