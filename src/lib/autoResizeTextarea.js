export function autoResize(el, options = {}) {
  if (!el) return

  const { adjustScroll = true, extraHeight = 0 } = options

  const selection = typeof document !== 'undefined' ? document.getSelection() : null
  let range = null
  let caretY = null
  if (selection && selection.rangeCount > 0) {
    const r = selection.getRangeAt(0)
    if (el.contains(r.startContainer)) {
      range = r
      const rect = r.getBoundingClientRect()
      if (rect && rect.top) caretY = rect.top
    }
  }

  let scrollEl = null
  let scrollTopBefore = 0
  for (let node = el.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    const overflowY = style.overflowY
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      scrollEl = node
      scrollTopBefore = node.scrollTop
      break
    }
  }

  const prevScrollTop = el.scrollTop
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 1 + extraHeight + 'px'

  if (adjustScroll && scrollEl && caretY != null && range) {
    const afterRect = range.getBoundingClientRect()
    const delta = afterRect.top - caretY
    if (delta) scrollEl.scrollTop = scrollTopBefore + delta
  } else if (el.scrollTop !== prevScrollTop) {
    el.scrollTop = prevScrollTop
  }
}
