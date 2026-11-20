/* Service worker: deixa o app funcionando sem internet e avisa quando há versão nova.
   Para publicar uma atualização: altere VERSAO (e version.js) e envie os arquivos para o site. */
const VERSAO = '1.3.4';
const CACHE = 'athletic-provas-' + VERSAO;
const ARQUIVOS = ['./', 'index.html', 'config-envio.js', 'logo-data.js', 'styles.css', 'app.js', 'data.js', 'pdf.js', 'version.js', 'manifest.webmanifest', 'celular.html', 'celular.css', 'celular.js', 'manifest-celular.webmanifest', 'assets/kick-64.png', 'assets/kick-192.png', 'assets/kick-512.png', 'lib/pdfjs-embutido.js',
  'assets/tela-inicial.jpg', 'assets/tela-karate-v6.jpg', 'assets/tela-kick-v6.jpg', 'assets/som-karate.wav', 'assets/som-kick-v3.wav',
  'assets/emblema-32.png', 'assets/emblema-64.png', 'assets/emblema-192.png', 'assets/emblema-512.png'];
// Guarda cada arquivo separadamente: se algum não estiver no site (ex.: config-envio.js),
// os outros são guardados assim mesmo e o app continua instalável.
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c =>
  Promise.all(ARQUIVOS.map(a => c.add(a).catch(() => {}))))));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('athletic-provas-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));
self.addEventListener('message', e => { if (e.data === 'atualizar') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
