const CACHE = "sheplates-v6-ultra-shell";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/sheplates-logo.png", "/sheplates-hero.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
    }
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || (event.request.mode === "navigate" ? caches.match("/") : undefined)).then((found) => found || Response.error())));
});

self.addEventListener("push", (event) => {
  let payload = { title: "Sheplates update", body: "Your order or schedule has an update.", url: "/" };
  try { payload = { ...payload, ...event.data.json() }; } catch { /* safe defaults */ }
  
  // Construct destination URL from payload view or explicit url
  let targetUrl = payload.url || "/";
  if (!payload.url && payload.view) {
    const params = new URLSearchParams();
    params.set("view", payload.view);
    if (payload.orderId) params.set("orderId", payload.orderId);
    if (payload.requirementId) params.set("requirementId", payload.requirementId);
    if (payload.dropId) params.set("dropId", payload.dropId);
    if (payload.ticketId) params.set("ticketId", payload.ticketId);
    targetUrl = `/?${params.toString()}`;
  }

  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: targetUrl, ...payload },
    tag: payload.tag || "sheplates-update",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const visible = clients.find((client) => "focus" in client);
    if (visible) {
      visible.focus();
      if ("navigate" in visible) {
        return visible.navigate(target);
      } else {
        visible.postMessage({ type: "SHEPLATES_NAVIGATE", url: target });
        return Promise.resolve();
      }
    }
    return self.clients.openWindow(target);
  }));
});
