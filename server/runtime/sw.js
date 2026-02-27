/**
 * ServiceWorker — 리소스 번들 캐싱
 *
 * install:
 *   1. bundles/manifest.json 에서 버전 + 번들 목록 확인
 *   2. 버전이 다르면 bundles/*.zip 다운로드 (병렬)
 *   3. JSZip으로 압축 해제 → Cache API 저장
 *   4. progress를 postMessage로 클라이언트에 전달
 *
 * fetch:
 *   img/audio/data/* 요청을 캐시에서 응답 (cache-first)
 *
 * manifest.json 구조:
 *   { version, bundles: [{ file: "img.zip", prefix: "img/" }, ...] }
 *   파일이 99MB를 넘으면 img_2.zip, img_3.zip 등으로 분할될 수 있음.
 */

importScripts('bundles/jszip.min.js');

const CACHE_PREFIX = 'game-bundle-';
const META_CACHE = 'game-bundle-meta';

/** scope URL에서 pathname base 추출 (e.g. "/game/" or "/repo/") */
function getScopeBase() {
  try {
    const p = new URL(self.registration.scope).pathname;
    return p.endsWith('/') ? p : p + '/';
  } catch {
    return '/';
  }
}

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

  const { version, bundles } = manifest;
  // bundles: [{ file: "img.zip", prefix: "img/" }, ...]

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

  // Phase 0: HEAD 요청으로 전체 파일 크기 사전 확인 → totalSize 역주행 방지
  const dlProgress = {};
  bundles.forEach(({ file }) => { dlProgress[file] = { received: 0, total: 0 }; });
  await Promise.all(bundles.map(async ({ file }) => {
    try {
      const r = await fetch(base + 'bundles/' + file, { method: 'HEAD', cache: 'no-store' });
      if (r.ok) dlProgress[file].total = parseInt(r.headers.get('Content-Length') || '0', 10);
    } catch {}
  }));

  await broadcast({
    type: 'bundle-start',
    version,
    files: bundles.map(({ file }) => ({ file, total: dlProgress[file].total })),
  });

  // Phase 1: 모든 ZIP 병렬 다운로드 (스트리밍 진행률 추적)
  async function fetchWithProgress(url, file) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${file} ${res.status}`);

    // Content-Length가 HEAD와 다를 경우를 대비해 갱신
    const contentLength = parseInt(res.headers.get('Content-Length') || '0', 10);
    if (contentLength > 0) dlProgress[file].total = contentLength;

    const reader = res.body.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      dlProgress[file].received += value.length;

      const totalReceived = Object.values(dlProgress).reduce((s, v) => s + v.received, 0);
      const totalSize = Object.values(dlProgress).reduce((s, v) => s + v.total, 0);
      const filesSnap = bundles.map(({ file: f }) => ({ file: f, received: dlProgress[f].received, total: dlProgress[f].total }));
      await broadcast({ type: 'bundle-download-progress', file, totalReceived, totalSize, files: filesSnap });
    }

    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const buf = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) { buf.set(chunk, offset); offset += chunk.length; }
    return buf.buffer;
  }

  const zipList = await Promise.all(bundles.map(async ({ file, prefix }) => {
    const buffer = await fetchWithProgress(base + 'bundles/' + file, file);
    const zip = await JSZip.loadAsync(buffer);
    return { prefix, zip, file };
  })).catch(async (e) => {
    await broadcast({ type: 'bundle-error', file: '', error: String(e) });
    return null;
  });
  if (!zipList) return;

  // Phase 2: 전체 파일 목록을 먼저 수집 → totalFiles 확정 (진행률 역주행 방지)
  const allEntries = [];
  for (const { prefix, zip } of zipList) {
    zip.forEach((relativePath, zipFile) => {
      if (!zipFile.dir) allEntries.push({ prefix, relativePath, zipFile });
    });
  }
  const totalFiles = allEntries.length;
  let loadedFiles = 0;
  await broadcast({ type: 'bundle-progress', totalFiles, loadedFiles });

  // Phase 3: 전체 파일 병렬 추출 → 캐시 저장
  await Promise.all(allEntries.map(async ({ prefix, relativePath, zipFile }) => {
    try {
      const data = await zipFile.async('arraybuffer');
      // prefix = "img/", relativePath = "characters/Actor1.png"
      // WebP 변환된 프로젝트: .webp 파일을 .png 키로 저장 → 게임의 .png 요청과 매칭
      const cacheKey = relativePath.replace(/\.webp$/i, '.png');
      const cacheUrl = base + prefix + cacheKey;
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
    } catch (e) {
      await broadcast({ type: 'bundle-error', file: relativePath, error: String(e) });
    }
  }));

  // 버전 저장
  await metaCache.put('version', new Response(version));

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
  const base = getScopeBase();
  let pathname;
  try { pathname = new URL(event.request.url).pathname; } catch { return; }

  const rel = pathname.startsWith(base)
    ? pathname.slice(base.length)
    : (pathname.startsWith('/') ? pathname.slice(1) : pathname);

  if (!['img/', 'audio/', 'data/'].some(d => rel.startsWith(d))) return;

  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const allCacheNames = (await caches.keys())
    .filter(k => k.startsWith(CACHE_PREFIX))
    .sort()
    .reverse();

  // .webp↔.png 대체 URL 생성 (WebP 변환 프로젝트 호환)
  // 게임이 .png 요청 → 캐시에 .webp만 있을 수도 있고, 반대도 마찬가지
  let altRequest = null;
  try {
    const u = new URL(request.url);
    const p = u.pathname;
    if (p.endsWith('.webp')) {
      u.pathname = p.slice(0, -5) + '.png';
      altRequest = new Request(u.toString());
    } else if (p.endsWith('.png')) {
      u.pathname = p.slice(0, -4) + '.webp';
      altRequest = new Request(u.toString());
    }
  } catch {}

  for (const cacheName of allCacheNames) {
    const cache = await caches.open(cacheName);
    // ignoreSearch: 캐시 버스팅 쿼리(?v=xxxxx)를 무시하고 경로만 비교
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    // 대체 확장자(.webp↔.png)로도 조회
    if (altRequest) {
      const altCached = await cache.match(altRequest, { ignoreSearch: true });
      if (altCached) return altCached;
    }
  }
  return fetch(request);
}
