// ============================================================
// Service Worker — пуш-уведомления WinChat / Wintozo
// ============================================================

const CACHE_NAME = 'winchat-push-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'WinChat';
  const body = data.body || 'Новое сообщение';
  const icon = data.icon || '/icon-192.png';
  const badge = data.badge || '/icon-192.png';
  const tag = data.tag || 'winchat';
  const url = data.url || '/';
  const chatId = data.chat_id || null;

  const options = {
    body,
    icon,
    badge,
    tag,
    data: { url, chatId },
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'close', title: 'Закрыть' }
    ],
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url || '/';

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Если окно уже открыто — сфокусировать его
      for (const client of clients) {
        if (client.url.includes(new URL(url).origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Иначе открыть новое окно
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  // Аналитика закрытия можно добавить здесь
});

// Фоновая синхронизация (опционально)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    // 앱 может синхронизировать сообщения при восстановлении соединения
  }
});
