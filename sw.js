/* Service worker sederhana untuk Kuis Muraja'ah: menyimpan salinan halaman ini
   supaya tetap bisa dibuka tanpa internet setelah kunjungan pertama.
   Data teks ayat sendiri disimpan terpisah lewat IndexedDB (lihat index.html),
   bukan lewat cache ini. */
const CACHE='muraja-ah-v1';
const ASSETS=['./','./index.html'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(
    caches.match(e.request).then(cached=>{
      const fetchPromise=fetch(e.request).then(res=>{
        try{
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(e.request,copy));
        }catch(err){}
        return res;
      }).catch(()=>cached);
      return cached||fetchPromise;
    })
  );
});
