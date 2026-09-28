/* Service worker Catatan Hafalan — cache agar bisa dibuka offline.
   Naikkan VERSION setiap kali mengganti file app agar HP mengambil versi baru. */
const VERSION = 'v2';
const CACHE = 'catatan-hafalan-' + VERSION;
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './icon-maskable-512.png', './apple-touch-icon.png', './favicon-32.png'];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'
];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cormorant+Garamond:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap';
// Layanan data yang tidak boleh di-cache
const NO_CACHE = ['script.google.com', 'script.googleusercontent.com', 'form.jotform.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Hanya halaman & manifest yang wajib; ikon yang hilang tidak boleh menggagalkan pemasangan
    await cache.addAll(['./', './index.html', './manifest.webmanifest']);
    await Promise.allSettled(CORE.slice(3).map((u) => cache.add(u)));
    // Pustaka & font: usahakan, tapi jangan gagalkan pemasangan bila sedang offline
    await Promise.allSettled(LIBS.map(async (u) => {
      const r = await fetch(u, { mode: 'no-cors' });
      await cache.put(u, r);
    }));
    try {
      const r = await fetch(FONT_CSS);
      const css = await r.clone().text();
      await cache.put(FONT_CSS, r);
      const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/['"]/g, ''));
      await Promise.allSettled(urls.map(async (u) => {
        const fr = await fetch(u, { mode: 'cors' });
        await cache.put(u, fr);
      }));
    } catch (e) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('catatan-hafalan-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (NO_CACHE.includes(url.hostname)) return;

  // Buka halaman: jaringan dulu (agar update cepat), cadangan dari cache saat offline
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok && url.origin === location.origin && !url.search) cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // File lain (termasuk font & pustaka): cache dulu, perbarui di latar belakang
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    const refresh = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { event.waitUntil(refresh); return hit; }
    return (await refresh) || Response.error();
  })());
});
