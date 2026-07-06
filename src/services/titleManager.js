let baseTitle = 'Scenara'
let unreadCount = 0

export function setBaseTitle(title) {
  baseTitle = title
  updateTitle()
}

export function setUnreadCount(count) {
  unreadCount = count
  updateTitle()
}

function updateTitle() {
  const prefix = unreadCount > 0 ? `(${unreadCount}) ` : ''
  document.title = prefix + baseTitle
}
