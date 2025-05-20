// Cache name will be set during install
let CACHE_NAME = null;

// Files to cache
const urlsToCache = [
  '/',
  '/index.html',
  '/table-styles.css',
  '/scripts/MainScript.js',
  '/scripts/auth.js',
  '/scripts/attendance.js',
  '/scripts/statsTables.js',
  '/scripts/sonMac.js',
  '/scripts/duello.js',
  '/scripts/teamPicker.js',
  '/scripts/players.js',
  '/scripts/performanceGraphs.js',
  '/scripts/themeToggle.js',
  '/images/BatakLogo.png'
];

// Install event - cache assets
self.addEventListener('install', event => {
  // Get the current build hash for cache versioning
  event.waitUntil(
    fetch('/build-info.json')
      .then(response => response.json())
      .then(data => {
        CACHE_NAME = `csbatagi-cache-${data.commitHash}`;
        return caches.open(CACHE_NAME);
      })
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName.startsWith('csbatagi-cache-') && cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  event.waitUntil(clients.claim());
});

// Fetch event - cache-first for static assets, network-first for dynamic content
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Network-first for dynamic content
  if (url.pathname.endsWith('.json') || url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Firebase Cloud Messaging event handlers
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.notification.body,
      icon: '/images/BatakLogo192.png',
      badge: '/images/BatakLogo192.png',
      data: data.data
    };
    event.waitUntil(
      self.registration.showNotification(data.notification.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
}); 