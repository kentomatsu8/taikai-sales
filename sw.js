/* オフラインでもアプリを開けるようにする仕組み（サービスワーカー）
 * ・アプリの画面ファイルをスマホに保存しておき、電波が無いときはそれを表示
 * ・電波があるときは最新版を取りに行く（3秒で返事がなければ保存版を使う）
 * ・シート（script.google.com）との通信には手を出さない
 */
const CACHE = 'taikai-v11';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const QR_LIB = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    try { await c.put(QR_LIB, await fetch(QR_LIB, { mode: 'no-cors' })); } catch (_) { /* カメラ用。失敗しても本体は動く */ }
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname.endsWith('google.com') || url.hostname.endsWith('googleusercontent.com')) return; // シート通信はそのまま
  if (url.origin === location.origin) {
    // 自分のファイル：まず最新版、だめなら保存版
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(e.request), new Promise((_, ng) => setTimeout(() => ng('timeout'), 3000))]);
        if (res && res.ok) c.put(e.request, res.clone());
        return res;
      } catch (_) {
        return (await c.match(e.request, { ignoreSearch: true })) || (await c.match('./index.html')) || Response.error();
      }
    })());
  } else if (e.request.url === QR_LIB) {
    e.respondWith(caches.match(QR_LIB).then(r => r || fetch(e.request)));
  }
});
