/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Workbox precaching — vite-plugin-pwa injects the manifest here
precacheAndRoute(self.__WB_MANIFEST);

// ─── Push Notification Handler ─────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'plugqueue',
    data: { url: data.url },
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      { action: 'confirm', title: "I'm plugging in" },
      { action: 'dismiss', title: 'Leave queue' },
    ],
  } as NotificationOptions;

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ─── Notification Click Handler ────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if one is open
      for (const client of clientList) {
        if (client.url.includes('/s/') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    })
  );
});
