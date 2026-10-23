// Guarda a app no telemóvel para abrir sem rede. Só guarda os ficheiros da
// própria app; o diário nunca passa por aqui (vive cifrado no IndexedDB).
// Mostra logo a versão guardada e vai buscar a nova por trás, para a próxima abertura.
const CACHE = 'oirad-leitor-v1'
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
  const fresh = fetch(req)
    .then(async res => {
      if (res.ok) await (await caches.open(CACHE)).put(req, res.clone())
      return res
    })
    .catch(() => null)
  e.waitUntil(fresh)
  e.respondWith((async () =>
    (await caches.match(req, { ignoreSearch: true })) ||
    (await fresh) ||
    new Response('Sem rede e sem cópia guardada.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  )())
})
