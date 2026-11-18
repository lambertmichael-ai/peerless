/* Peerless Daily service worker: offline shell, morning push, tap to open. */
const VERSION = "dev";
const CACHE = "peerless-" + VERSION;
const SHELL = ["./", "index.html", "css/app.css", "js/config.js", "js/platform.js", "js/figures.js", "js/content.js", "js/steps.js", "js/app.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("peerless-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
/* Same-origin files: network first so a new deploy shows up at once, cache when offline.
   Everything else (Firebase, Gemini, Drive, fonts) goes straight to the network. */
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
});
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Peerless Daily", {
    body: d.body || "Your stations are open.", icon: "icons/icon-192.png", badge: "icons/icon-192.png",
    tag: "peerless-morning", renotify: true, data: { url: d.url || "./#today" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./#today", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    for (const w of ws) if (w.url.startsWith(self.registration.scope)) { w.navigate(url); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
