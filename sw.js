// sw.js - Service Worker básico para caching y manejo de Push/notification click
const CACHE_NAME = 'solazo-cache-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE_ASSETS = [ '/', '/index.html', '/style.css', '/app.js', '/assets/placeholder.jpg' ];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  // intenta cache primero para recursos estáticos
  if(req.method !== 'GET') return;
  evt.respondWith(
    caches.match(req).then(cached => {
      if(cached) return cached;
      return fetch(req).then(resp => {
        // opcional: cachear respuestas de navegación HTML
        if(req.destination === 'document' || req.headers.get('accept')?.includes('text/html')){
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return resp;
      }).catch(() => caches.match(OFFLINE_URL));
    })
  );
});

// Push event - muestra notificación simple
self.addEventListener('push', (event) => {
  let data = {};
  try{ data = event.data.json(); }catch(e){ data = { title: 'El Solazo', body: event.data?.text() || 'Nuevas noticias' }; }
  const title = data.title || 'El Solazo';
  const options = {
    body: data.body || 'Toque para leer',
    icon: data.icon || '/assets/favicon.ico',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.matchAll({ type: 'window' }).then(windowClients => {
    for (let client of windowClients) {
      if (client.url === url && 'focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
