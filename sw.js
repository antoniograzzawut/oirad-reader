// Guarda a app no telemóvel para abrir sem rede. Só guarda os ficheiros da
// própria app; o diário nunca passa por aqui (vive cifrado no IndexedDB).
// Com rede vai sempre buscar a versão nova; sem rede usa a guardada.
const CACHE = 'oirad-leitor-v2'
const SHELL = ['./', 'index.html', 'app.js', 'core.js', 'look.js', 'manifest.json', 'icon-192.png', 'icon-512.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()))
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' })
      if (res.ok) await (await caches.open(CACHE)).put(req, res.clone())
      return res
    } catch {
      return (await caches.match(req, { ignoreSearch: true })) ||
        new Response('Sem rede e sem cópia guardada.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
  })())
})
