/* Lista de Lugares — guarda o guia no celular quando ele é aberto pelo link (https).
   Página: tenta a rede primeiro (para receber atualizações) e, se a internet falhar ou demorar,
   abre a cópia guardada. Blocos do mapa já vistos também ficam guardados, então o mapa funciona
   sem internet nas áreas que ela já abriu. O guia é um arquivo só, então não há lista de arquivos. */
const GUIA = 'lista-lugares-guia-v1'
const MAPA = 'lista-lugares-mapa-v1'
const ESPERA_REDE_MS = 4000

// Na instalação guarda a própria página (a pasta do guia e o index.html): a primeira abertura acontece antes de o worker assumir,
// então sem isso a página nunca entraria no cache e não reabriria sem internet.
self.addEventListener('install', (e) => {
  self.skipWaiting()
  const base = self.registration.scope
  e.waitUntil(caches.open(GUIA).then((cache) => Promise.allSettled([cache.add(base), cache.add(base + 'index.html')])))
})
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

const comTempo = (promessa, ms) => Promise.race([promessa, new Promise((_, recusa) => setTimeout(() => recusa(new Error('lento')), ms))])

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (/tile\.openstreetmap/.test(url.hostname)) {
    e.respondWith(
      caches.open(MAPA).then(async (cache) => (await cache.match(req)) || fetch(req).then((r) => {
        if (r.ok) cache.put(req, r.clone())
        return r
      })),
    )
    return
  }
  e.respondWith((async () => {
    const cache = await caches.open(GUIA)
    try {
      const r = await comTempo(fetch(req), ESPERA_REDE_MS)
      if (r.ok) cache.put(req, r.clone())
      return r
    } catch {
      return (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' && (await cache.match(self.registration.scope))) || Response.error()
    }
  })())
})
