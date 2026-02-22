/**
 * ServiceWorker — 리소스 번들 캐싱
 *
 * install:
 *   1. /game/bundles/manifest.json 에서 버전 확인
 *   2. 버전이 다르면 img/audio/data.zip 3개를 병렬 다운로드
 *   3. JSZip으로 압축 해제 → Cache API 저장
 *   4. progress를 postMessage로 클라이언트에 전달
 *
 * fetch:
 *   /game/img|audio|data/* 요청을 캐시에서 응답 (cache-first)
 */

importScripts('/game/js/libs/jszip.min.js');

const CACHE_PREFIX = 'game-bundle-';
const META_CACHE = 'game-bundle-meta';
const INTERCEPT_PATHS = ['/game/img/', '/game/audio/', '/game/data/'];

// 번들명 → 캐시 내 경로 prefix 매핑
const BUNDLE_PREFIXES = {
  img:   '/game/img/',
  audio: '/game/audio/',
  data:  '/game/data/',
};

// 파일 확장자 → Content-Type
function mimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    ogg: 'audio/ogg', mp3: 'audio/mpeg', m4a: 'audio/mp4',
    wav: 'audio/wav', opus: 'audio/opus',
    json: 'application/json', js: 'application/javascript',
    css: 'text/css', html: 'text/html', txt: 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

// 모든 클라이언트에게 메시지 전송
async function broadcast(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach(c => c.postMessage(msg));
}

// ── install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(installBundles());
});

async function installBundles() {
  // manifest 로드
  let manifest;
  try {
    const res = await fetch('/game/bundles/manifest.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('manifest ' + res.status);
    manifest = await res.json();
  } catch (e) {
    // 번들 API 없으면 SW는 그냥 pass-through로 동작
    await broadcast({ type: 'bundle-skip', reason: String(e) });
    return;
  }

  const { version, bundles } = manifest;

  // 이미 이 버전 캐시가 있으면 스킵
  const metaCache = await caches.open(META_CACHE);
  const cachedVersionRes = await metaCache.match('/bundle-version');
  if (cachedVersionRes) {
    const cachedVersion = await cachedVersionRes.text();
    if (cachedVersion === version) {
      await broadcast({ type: 'bundle-ready', version, cached: true });
      return;
    }
  }

  // 새 캐시 열기
  const cacheName = CACHE_PREFIX + version;
  const dataCache = await caches.open(cacheName);

  await broadcast({ type: 'bundle-start', version, bundles });

  let totalFiles = 0;
  let loadedFiles = 0;

  // 3개 ZIP 병렬 다운로드 + 압축 해제
  await Promise.all(bundles.map(async (bundle) => {
    const prefix = BUNDLE_PREFIXES[bundle];
    if (!prefix) return;

    try {
      // 다운로드 (progress 표시용 reader)
      const res = await fetch('/game/bundles/' + bundle + '.zip', { cache: 'no-store' });
      if (!res.ok) throw new Error(bundle + '.zip ' + res.status);

      const buffer = await res.arrayBuffer();

      // JSZip 압축 해제
      const zip = await JSZip.loadAsync(buffer);

      // 파일 목록 수집
      const fileEntries = [];
      zip.forEach((relativePath, file) => {
        if (!file.dir) fileEntries.push({ relativePath, file });
      });
      totalFiles += fileEntries.length;
      await broadcast({ type: 'bundle-progress', bundle, step: 'extract', totalFiles, loadedFiles });

      // Cache API에 저장 (병렬)
      await Promise.all(fileEntries.map(async ({ relativePath, file }) => {
        const data = await file.async('arraybuffer');
        const cacheUrl = prefix + relativePath;
        await dataCache.put(
          new Request(cacheUrl),
          new Response(data, {
            headers: {
              'Content-Type': mimeType(relativePath),
              'Content-Length': String(data.byteLength),
            },
          })
        );
        loadedFiles++;
        if (loadedFiles % 5 === 0 || loadedFiles === totalFiles) {
          await broadcast({ type: 'bundle-progress', totalFiles, loadedFiles });
        }
      }));
    } catch (e) {
      await broadcast({ type: 'bundle-error', bundle, error: String(e) });
    }
  }));

  // 버전 저장
  await metaCache.put('/bundle-version', new Response(version));

  // 오래된 캐시 삭제
  const allCaches = await caches.keys();
  await Promise.all(
    allCaches
      .filter(k => k.startsWith(CACHE_PREFIX) && k !== cacheName)
      .map(k => caches.delete(k))
  );

  await broadcast({ type: 'bundle-ready', version, totalFiles });
}

// ── activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// ── fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { pathname } = new URL(event.request.url);
  const intercept = INTERCEPT_PATHS.some(p => pathname.startsWith(p));
  if (!intercept) return;

  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  // 모든 버전 캐시에서 검색 (최신 버전 우선)
  const allCacheNames = (await caches.keys())
    .filter(k => k.startsWith(CACHE_PREFIX))
    .sort()
    .reverse();

  for (const cacheName of allCacheNames) {
    const cached = await caches.open(cacheName).then(c => c.match(request));
    if (cached) return cached;
  }

  // 캐시 미스 → 네트워크
  return fetch(request);
}
