// Nama cache kita
const CACHE_NAME = 'penyetan-pwa-v1';

// Daftar file yang akan disimpan di memori HP (agar bisa dimuat lebih cepat)
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/main.js',
  '/favicon/android-chrome-192x192.png',
  '/favicon/android-chrome-512x512.png'
];

// Proses Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
    .then(cache => {
      console.log('Membuka cache');
      return cache.addAll(urlsToCache);
    })
  );
});

// Proses Fetch (Mengambil data)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
    .then(response => {
      // Jika file ada di cache, gunakan itu. Jika tidak, ambil dari internet.
      if (response) {
        return response;
      }
      return fetch(event.request);
    })
  );
});

// Proses Update Service Worker (Menghapus cache lama jika ada versi baru)
self.addEventListener('activate', event => {
  const cacheAllowlist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheAllowlist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});