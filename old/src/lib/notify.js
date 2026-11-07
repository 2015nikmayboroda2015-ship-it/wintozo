/**
 * Уведомления о новых сообщениях для старого Wintozo (legacy).
 * Браузер + Android (WebView).
 */

let permissionRequested = false

export async function requestNotifyPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (permissionRequested) return Notification.permission === 'granted'
  permissionRequested = true
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

export function showMessageNotification(opts) {
  const { title, body, icon = '/icon-192.png', tag = 'winchat-message', url = '/', chatId = null } = opts
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const notification = new Notification(title, {
    body,
    icon,
    tag,
    data: { url, chatId },
    renotify: true,
  })

  notification.onclick = () => {
    window.focus()
    if (url) {
      const u = new URL(url, window.location.origin)
      window.location.href = u.pathname + u.search
    }
    notification.close()
  }

  setTimeout(() => notification.close(), 5000)
}

export function showMessageNotificationIfHidden(opts) {
  if (typeof document === 'undefined') return
  if (!document.hidden && document.hasFocus()) return
  showMessageNotification(opts)
}
