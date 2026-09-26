// SINA Admin App - Progressive Web App (PWA) Service Worker & Push Notification Receiver
const CACHE_NAME = 'sina-admin-cache-v1';

const STATIC_ASSETS = [
  './',
  'index.html',
  'settings.html',
  'approvals.html',
  'representatives.html',
  'rep-detail.html',
  'firms.html',
  'firm-detail.html',
  'history.html',
  'analytics.html',
  'catalog.html',
  'godowns.html',
  'bank-accounts.html',
  'purchasing-firms.html',
  'receipts.html',
  'locations.html',
  'sources.html',
  'subtypes.html',
  'login.html',
  'manifest.json',
  'css/base.css',
  'css/components.css',
  'css/admin.css',
  'js/config.js',
  'js/icons.js',
  'js/db.js',
  'js/auth.js',
  'js/translate.js',
  'js/nav.js',
  'js/settings.js',
  'assets/logo.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-192.png',
  'assets/icon-maskable-512.png',
  'assets/apple-touch-icon.png',
  'favicon.ico'
];

// INSTALL: Pre-cache static shell & activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache addAll partial warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ACTIVATE: Purge stale caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH: Network-first strategy with cache fallback (Zero stale updates while online)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip caching external Supabase database & analytics endpoints
  if (url.hostname.includes('supabase.co') || url.hostname.includes('google')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && url.origin === self.location.origin) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
            return caches.match('index.html');
          }
        });
      })
  );
});

// PUSH NOTIFICATIONS EVENT LISTENER
self.addEventListener('push', (e) => {
  let data = {};
  if (e.data) {
    try {
      data = e.data.json();
    } catch (err) {
      data = { title: 'SINA Admin', body: e.data.text() };
    }
  }

  const title = data.title || 'SINA Operations Alert';
  const options = {
    body: data.body || 'New purchase entry or payment approval required.',
    icon: 'assets/icon-192.png',
    badge: 'assets/icon-192.png',
    vibrate: [150, 50, 150],
    data: {
      url: data.url || 'approvals.html',
      dateOfArrival: Date.now(),
      primaryKey: data.primaryKey || 1
    },
    actions: [
      { action: 'open', title: 'Open Portal' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// NOTIFICATION CLICK EVENT LISTENER
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  if (e.action === 'close') return;

  const targetUrl = (e.notification.data && e.notification.data.url) ? e.notification.data.url : 'approvals.html';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if ('focus' in client) {
          if (client.url.includes(targetUrl)) {
            return client.focus();
          }
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
