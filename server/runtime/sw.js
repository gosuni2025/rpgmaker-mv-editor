/**
 * ServiceWorker — 리소스 캐싱
 *
 * install:
 *   1. bundles/manifest.json 에서 버전 + 파일 목록 확인
 *   2. 버전이 다르면 img/audio/data 파일을 개별 병렬 fetch
 *   3. Cache API 저장 + progress postMessage
 *
 * fetch:
 *   img/audio/data/* 요청을 캐시에서 응답 (cache-first)
 */

const CACHE_PREFIX = 'game-bundle-';
const META_CACHE = 'game-bundle-meta';
const INTERCEPT_DIRS = ['img/', 'audio/', 'data/'];
const FETCH_CONCURRENCY = 8;

/** scope URL에서 pathname base 추출 (e.g. "/game/" or "/repo/game/") */
function getScopeBase() {
  try {
    const p = new URL(self.registration.scope).pathname;
    // 반드시 /로 끝나도록
    return p.endsWith('/') ? p : p + '/';
  } catch {
    return '/';
  }
}

async function broadcast(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach(c => c.postMessage(msg));
}

// ── install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(installFromManifest());
});

async function installFromManifest() {
  const base = getScopeBase();

  // manifest 로드
  let manifest;
  try {
    const res = await fetch(base + 'bundles/manifest.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('manifest ' + res.status);
    manifest = await res.json();
  } catch (e) {
    await broadcast({ type: 'bundle-skip', reason: String(e) });
    return;
  }

  const { version, files } = manifest;
  if (!Array.isArray(files) || files.length === 0) {
    await broadcast({ type: 'bundle-skip', reason: 'empty file list' });
    return;
  }

  // 이미 이 버전 캐시가 있으면 스킵
  const metaCache = await caches.open(META_CACHE);
  const cachedVersionRes = await metaCache.match('version');
  if (cachedVersionRes) {
    const cachedVersion = await cachedVersionRes.text();
    if (cachedVersion === version) {
      await broadcast({ type: 'bundle-ready', version, cached: true });
      return;
    }
  }

  const cacheName = CACHE_PREFIX + version;
  const dataCache = await caches.open(cacheName);

  const total = files.length;
  let loaded = 0;
  await broadcast({ type: 'bundle-progress', totalFiles: total, loadedFiles: 0 });

  async function fetchAndCache(filePath) {
    const url = base + filePath;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        await dataCache.put(new Request(url), res);
      }
    } catch (e) {
      console.warn('[SW] fetch failed:', url, String(e));
    }
    loaded++;
    if (loaded % 10 === 0 || loaded === total) {
      await broadcast({ type: 'bundle-progress', totalFiles: total, loadedFiles: loaded });
    }
  }

  // FETCH_CONCURRENCY개씩 병렬 처리
  for (let i = 0; i < files.length; i += FETCH_CONCURRENCY) {
    await Promise.all(files.slice(i, i + FETCH_CONCURRENCY).map(fetchAndCache));
  }

  // 버전 저장
  await metaCache.put('version', new Response(version));

  // 오래된 캐시 삭제
  const allCaches = await caches.keys();
  await Promise.all(
    allCaches
      .filter(k => k.startsWith(CACHE_PREFIX) && k !== cacheName)
      .map(k => caches.delete(k))
  );

  await broadcast({ type: 'bundle-ready', version, totalFiles: total });
}

// ── activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// ── fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const base = getScopeBase();
  let pathname;
  try {
    pathname = new URL(event.request.url).pathname;
  } catch {
    return;
  }

  // base prefix 이후 상대 경로로 확인
  const rel = pathname.startsWith(base)
    ? pathname.slice(base.length)
    : (pathname.startsWith('/') ? pathname.slice(1) : pathname);

  if (!INTERCEPT_DIRS.some(d => rel.startsWith(d))) return;

  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const allCacheNames = (await caches.keys())
    .filter(k => k.startsWith(CACHE_PREFIX))
    .sort()
    .reverse();

  for (const cacheName of allCacheNames) {
    const cached = await caches.open(cacheName).then(c => c.match(request));
    if (cached) return cached;
  }

  return fetch(request);
}
