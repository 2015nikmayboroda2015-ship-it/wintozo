/**
 * Уведомления о новых сообщениях — браузер + Android (WebView).
 * Не пуш-подписки, а обычные локальные уведомления при получении сообщения.
 */

let permissionRequested = false

/** Запросить разрешение на уведомления (один раз). */
export async function requestNotifyPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (permissionRequested) return Notification.permission === 'granted'
  permissionRequested = true
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

/** Показать уведомление о новом сообщении. */
export function showMessageNotification({
  title,
  body,
  icon = '/icon-192.png',
  tag = 'winchat-message',
  url = '/',
  chatId = null,
}: {
  title: string
  body: string
  icon?: string
  tag?: string
  url?: string
  chatId?: string | null
}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const notification = new Notification(title, {
    body,
    icon,
    tag,
    data: { url, chatId },
  })

  notification.onclick = () => {
    window.focus()
    if (url) {
      const u = new URL(url, window.location.origin)
      window.location.href = u.pathname + u.search
    }
    notification.close()
  }

  // Авто-закрытие через 5 секунд
  setTimeout(() => notification.close(), 5000)
}

/** Показать уведомление только если приложение не в фокусе. */
export function showMessageNotificationIfHidden(opts: {
  title: string
  body: string
  icon?: string
  tag?: string
  url?: string
  chatId?: string | null
}) {
  if (typeof document === 'undefined') return
  if (!document.hidden && document.hasFocus()) return
  showMessageNotification(opts)
}
