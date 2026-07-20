const CACHE_NAME = "flow-pos-v2";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.jpg",
  "/icon-512.jpg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
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

self.addEventListener("fetch", (e) => {
  if (e.request.url.startsWith("http")) {
    e.respondWith(
      fetch(e.request).catch(() => {
        return caches.match(e.request);
      })
    );
  }
});

// Push notification handling for background mobile & desktop notifications
self.addEventListener("push", (event) => {
  let data = { title: "🔔 Pesanan Baru Masuk!", body: "Ada pesanan baru di toko Anda." };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (err) {}

  const options = {
    body: data.body || "Ada pesanan baru masuk.",
    icon: "/icon-192.jpg",
    badge: "/icon-192.jpg",
    vibrate: [200, 100, 200, 100, 200],
    data: data.url || "/customer-orders",
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "🔔 Pesanan Baru Masuk!", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data || "/customer-orders";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
