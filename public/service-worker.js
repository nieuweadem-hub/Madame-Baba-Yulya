const CACHE_NAME = 'cassandra-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/static/js/bundle.js',
  'https://i.ibb.co/23fbnhw6/Cassandra.png' // Je achtergrondafbeelding
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Retourneer cache, of haal op via netwerk
      return response || fetch(event.request);
    })
  );
});
