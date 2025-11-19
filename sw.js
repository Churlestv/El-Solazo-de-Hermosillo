// sw.js - Service Worker optimizado de El Solazo

const CACHE_NAME = 'solazo';

// Recursos precargados
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
];

// ==================== INSTALACIÓN ====================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// ==================== ACTIVACIÓN ====================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => key !== CACHE_NAME && caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ==================== ESTRATEGIA DE FETCH ====================
self.addEventListener('fetch', event => {
  const req = event.request;

  // Evita interferencias con POST, PUT, DELETE, etc.
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req)
        .then(networkResp => {
          // cache solo respuestas OK
          if (networkResp.status === 200 && networkResp.type === 'basic') {
            const respClone = networkResp.clone();
            caches.open(CACHE_NAME).then(cache => {
              // solo cachea documentos, CSS, JS, imágenes
              if (
                req.destination === 'document' ||
                req.destination === 'script' ||
                req.destination === 'style' ||
                req.destination === 'image'
              ) {
                cache.put(req, respClone);
              }
            });
          }
          return networkResp;
        })
        .catch(() => cached || caches.match(OFFLINE_URL));

      // Stale-While-Revalidate
      return cached || fetchPromise;
    })
  );
});

// ==================== NOTIFICACIONES PUSH ====================
self.addEventListener('push', event => {
  let data = {};

  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'El Solazo', body: event.data?.text() };
  }

  const title = data.title || 'El Solazo';
  const options = {
    body: data.body || 'Haz clic para leer la noticia',
    icon: data.icon || '/assets/icon-512.png',
    badge: '/assets/badge.png',
    data: {
      url: data.url || '/',
    },
    vibrate: [80, 40, 80],
    actions: [
      {
        action: 'open',
        title: 'Abrir',
      }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ==================== CLIC EN NOTIFICACIÓN ====================
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
      // Si está abierta una ventana con esa URL, enfocarla
      for (let client of clientsArr) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no existe, abrir nueva ventana
      return clients.openWindow(url);
    })
  );
});
