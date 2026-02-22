import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { exec } from 'child_process';
import archiver from 'archiver';
import sharp from 'sharp';
import projectManager from '../../services/projectManager';
import settingsManager from '../../services/settingsManager';
import { openInExplorer } from './helpers';

const router = express.Router();

export const DEPLOYS_DIR = path.join(os.homedir(), '.rpg-editor', 'deploys');
// Generator: 에디터 전용 캐릭터 생성기 에셋, 웹 배포에 불필요
// 소문자로 비교 (macOS/Windows 대소문자 혼용 대응)
export const EXCLUDE_DIRS_LOWER = new Set(['save', '.git', 'node_modules', 'generator']);
export const EXCLUDE_FILES = new Set(['.DS_Store', 'Thumbs.db', 'Game.rpgproject']);

// ─── 캐시 버스팅 옵션 ─────────────────────────────────────────────────────────
export interface CacheBustOptions {
  scripts?:      boolean; // HTML 정적 script/link + PluginManager 동적 로드
  images?:       boolean; // img/
  audio?:        boolean; // audio/
  video?:        boolean; // movies/
  data?:         boolean; // data/
  filterUnused?: boolean; // 미사용 에셋 제외
  convertWebp?:  boolean; // PNG → WebP 무손실 변환 (배포 용량/트래픽 절감)
}

// ─── 미사용 에셋 필터링 ───────────────────────────────────────────────────────

/** data/js에서 참조가 감지된 이름만 포함할 디렉터리 (audio/se 등) */
const FILTERABLE_DIRS = new Set([
  'audio/se', 'audio/bgm', 'audio/bgs', 'audio/me',
  'img/animations', 'img/battlebacks1', 'img/battlebacks2',
  'img/characters', 'img/enemies', 'img/faces', 'img/parallaxes',
  'img/pictures', 'img/sv_actors', 'img/sv_enemies',
  'img/titles1', 'img/titles2', 'img/tilesets',
]);

function extractStringValues(obj: unknown, out: Set<string>): void {
  if (typeof obj === 'string') {
    const s = obj.trim();
    if (s && s.length >= 1 && s.length <= 128 && !s.includes('/') && !s.includes('\\') && !s.includes('\n')) {
      out.add(s.toLowerCase());
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) extractStringValues(item, out);
  } else if (obj !== null && typeof obj === 'object') {
    for (const val of Object.values(obj as Record<string, unknown>)) extractStringValues(val, out);
  }
}

/** data/*.json + js/plugins/*.js 에서 참조되는 에셋 이름(소문자, 확장자 없음) 수집 */
export function collectUsedAssetNames(projectPath: string): Set<string> {
  const names = new Set<string>();

  // data/*.json — JSON 구조 전체에서 문자열 값 추출
  const dataDir = path.join(projectPath, 'data');
  if (fs.existsSync(dataDir)) {
    for (const file of fs.readdirSync(dataDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        extractStringValues(JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')), names);
      } catch {}
    }
  }

  // js/plugins/*.js — 따옴표 안 문자열(경로 구분자 없음) 추출
  const pluginsDir = path.join(projectPath, 'js', 'plugins');
  if (fs.existsSync(pluginsDir)) {
    for (const file of fs.readdirSync(pluginsDir)) {
      if (!file.endsWith('.js')) continue;
      try {
        const content = fs.readFileSync(path.join(pluginsDir, file), 'utf8');
        for (const m of content.matchAll(/["']([^"'\\/\n\r]{1,80})["']/g)) {
          names.add(m[1].trim().toLowerCase());
        }
      } catch {}
    }
  }

  return names;
}

/** 배포할 파일 목록을 상대경로 배열로 반환
 * usedNames가 주어지면 FILTERABLE_DIRS 안의 파일은 이름이 포함된 것만 포함 */
export function collectFilesForDeploy(baseDir: string, subDir = '', usedNames?: Set<string>): string[] {
  const currentDir = subDir ? path.join(baseDir, subDir) : baseDir;
  const results: string[] = [];
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (EXCLUDE_FILES.has(entry.name)) continue;
    const rel = subDir ? `${subDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS_LOWER.has(entry.name.toLowerCase())) continue;
      results.push(...collectFilesForDeploy(baseDir, rel, usedNames));
    } else {
      if (usedNames && subDir && FILTERABLE_DIRS.has(subDir.toLowerCase())) {
        const baseName = path.basename(entry.name, path.extname(entry.name)).toLowerCase();
        if (!usedNames.has(baseName)) continue;
      }
      results.push(rel);
    }
  }
  return results;
}

export function applyIndexHtmlRename(stagingDir: string) {
  const idx3d = path.join(stagingDir, 'index_3d.html');
  const idxMain = path.join(stagingDir, 'index.html');
  const idxPixi = path.join(stagingDir, 'index_pixi.html');
  if (fs.existsSync(idxMain) && !fs.existsSync(idxPixi)) {
    fs.renameSync(idxMain, idxPixi);
  }
  if (fs.existsSync(idx3d)) {
    fs.renameSync(idx3d, idxMain);
  }
}

/** HTML 파일에 캐시 버스팅 쿼리 및 window.__CACHE_BUST__ 주입 */
export function applyCacheBusting(stagingDir: string, buildId: string, opts: CacheBustOptions = {}) {
  const doScripts = opts.scripts !== false;
  const cb = JSON.stringify({
    buildId,
    scripts: opts.scripts !== false,
    images:  opts.images  !== false,
    audio:   opts.audio   !== false,
    video:   opts.video   !== false,
    data:    opts.data    !== false,
    webp:    opts.convertWebp === true,
  });

  const htmlFiles = fs.readdirSync(stagingDir).filter((f: string) => f.endsWith('.html'));
  for (const htmlFile of htmlFiles) {
    const htmlPath = path.join(stagingDir, htmlFile);
    let html = fs.readFileSync(htmlPath, 'utf-8');

    if (doScripts) {
      html = html.replace(
        /((?:src|href)="[^"?]+\.(?:js|css))(?:\?[^"]*)?"/g,
        (_: string, base: string) => `${base}?v=${buildId}"`,
      );
    }

    // window.__BUILD_ID__ (하위 호환) + window.__CACHE_BUST__ (카테고리별 옵션) 주입
    html = html.replace(
      '<head>',
      `<head>\n    <script>window.__BUILD_ID__='${buildId}';window.__CACHE_BUST__=${cb};</script>`,
    );

    fs.writeFileSync(htmlPath, html, 'utf-8');
  }
}

export function makeBuildId(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
}

export function setupSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

export function sseWrite(res: Response, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/** query string에서 CacheBustOptions 파싱 (GET SSE용 / POST body 재사용) */
export function parseCacheBustQuery(query: Record<string, unknown>): CacheBustOptions {
  const flag = (key: string) => query[key] !== '0';
  return {
    scripts: flag('cbScripts'),
    images:  flag('cbImages'),
    audio:   flag('cbAudio'),
    video:   flag('cbVideo'),
    data:    flag('cbData'),
    // GET: cbFilterUnused=1, POST body: filterUnused=true
    filterUnused: query['cbFilterUnused'] === '1' || query['filterUnused'] === true,
    // GET: cbConvertWebp=1, POST body: convertWebp=true
    convertWebp: query['cbConvertWebp'] === '1' || query['convertWebp'] === true,
  };
}

/** img/ 하위 PNG 파일을 WebP lossless로 변환하고 원본 삭제. 변환 수 반환 */
async function convertImagesToWebP(
  stagingDir: string,
  onEvent: (data: object) => void,
): Promise<number> {
  const imgDir = path.join(stagingDir, 'img');
  if (!fs.existsSync(imgDir)) return 0;

  const pngFiles: string[] = [];
  function collectPng(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collectPng(full);
      else if (entry.name.toLowerCase().endsWith('.png')) pngFiles.push(full);
    }
  }
  collectPng(imgDir);

  if (pngFiles.length === 0) return 0;
  onEvent({ type: 'log', message: `PNG → WebP 변환 중 (${pngFiles.length}개)...` });

  const total = pngFiles.length;
  let converted = 0;
  for (const pngPath of pngFiles) {
    const filename = path.relative(imgDir, pngPath);
    onEvent({ type: 'log', message: `  ${filename}` });
    onEvent({ type: 'progress', current: converted, total });
    const webpPath = pngPath.slice(0, -4) + '.webp';
    await sharp(pngPath).webp({ lossless: true }).toFile(webpPath);
    fs.unlinkSync(pngPath);
    converted++;
    onEvent({ type: 'progress', current: converted, total });
  }
  return converted;
}

async function zipStagingWithProgress(
  stagingDir: string,
  zipPath: string,
  fileTotal: number,
  onProgress: (current: number, total: number, name: string) => void,
): Promise<void> {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  return new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    let current = 0;
    archive.on('entry', (entry) => {
      current++;
      onProgress(Math.min(current, fileTotal), fileTotal, String(entry.name || ''));
    });
    archive.on('error', reject);
    output.on('close', resolve);
    archive.pipe(output);
    archive.directory(stagingDir, false);
    archive.finalize();
  });
}

/** 게임 제목을 Netlify 사이트 이름 규칙(소문자+숫자+하이픈)으로 변환 */
function toNetlifySiteName(gameTitle: string): string {
  return (gameTitle || 'rpgmaker-game')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    || 'rpgmaker-game';
}

function netlifyCreateSite(
  apiKey: string,
  name: string,
): Promise<{ id: string; name: string; ssl_url?: string }> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ name });
    const options: https.RequestOptions = {
      hostname: 'api.netlify.com',
      path: '/api/v1/sites',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            const msg = Array.isArray(json.errors) ? json.errors.join(', ') : (json.message || json.error);
            reject(new Error(msg || `Netlify API 오류 (HTTP ${res.statusCode})`));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error(`응답 파싱 실패: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function netlifyUpload(
  apiKey: string,
  siteId: string,
  zipPath: string,
  onProgress?: (sent: number, total: number) => void,
): Promise<{ id: string; deploy_ssl_url?: string; ssl_url?: string; url?: string }> {
  return new Promise((resolve, reject) => {
    const totalSize = fs.statSync(zipPath).size;
    const options: https.RequestOptions = {
      hostname: 'api.netlify.com',
      path: `/api/v1/sites/${siteId}/deploys`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/zip',
        'Content-Length': totalSize,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(json.message || json.error || `Netlify API 오류 (HTTP ${res.statusCode})`));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error(`응답 파싱 실패: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);

    let sent = 0;
    let lastPct = -1;
    const fileStream = fs.createReadStream(zipPath);
    fileStream.on('data', (chunk: Buffer) => {
      sent += chunk.length;
      if (onProgress) {
        const pct = Math.floor((sent / totalSize) * 100);
        if (pct !== lastPct) { lastPct = pct; onProgress(sent, totalSize); }
      }
      const canContinue = req.write(chunk);
      if (!canContinue) fileStream.pause();
    });
    req.on('drain', () => fileStream.resume());
    fileStream.on('end', () => req.end());
    fileStream.on('error', reject);
  });
}

export function getGameTitle(): string {
  if (!projectManager.isOpen()) return 'game';
  try {
    const system = projectManager.readJSON('System.json') as { gameTitle?: string };
    return system.gameTitle || 'game';
  } catch {
    return 'game';
  }
}

/** 파일 복사 + ZIP 생성 공통 로직 (SSE 프로그레스 콜백 포함) */
export async function buildDeployZipWithProgress(
  srcPath: string,
  gameTitle: string,
  opts: CacheBustOptions,
  onEvent: (data: object) => void,
): Promise<string> {
  fs.mkdirSync(DEPLOYS_DIR, { recursive: true });

  onEvent({ type: 'status', phase: 'counting' });
  onEvent({ type: 'log', message: '── 파일 수집 ──' });
  let usedNames: Set<string> | undefined;
  if (opts.filterUnused) {
    onEvent({ type: 'log', message: '미사용 에셋 분석 중...' });
    usedNames = collectUsedAssetNames(srcPath);
  }
  const files = collectFilesForDeploy(srcPath, '', usedNames);
  const total = files.length;
  onEvent({ type: 'counted', total });
  onEvent({ type: 'log', message: `파일 ${total}개 수집${opts.filterUnused ? ' (미사용 에셋 제외됨)' : ''}` });

  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rpgdeploy-'));
  try {
    let current = 0;
    for (const rel of files) {
      const destFile = path.join(stagingDir, rel);
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(path.join(srcPath, rel), destFile);
      current++;
      if (current % 20 === 0 || current === total) {
        onEvent({ type: 'progress', current, total });
      }
    }
    onEvent({ type: 'log', message: '✓ 복사 완료' });

    // 프로젝트가 이미 WebP인지 확인 (PNG 없고 WebP 있으면)
    const stagingImgDir = path.join(stagingDir, 'img');
    let projectIsWebp = false;
    if (fs.existsSync(stagingImgDir)) {
      function hasPng(dir: string): boolean {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (e.isDirectory()) { if (hasPng(path.join(dir, e.name))) return true; }
          else if (e.name.toLowerCase().endsWith('.png')) return true;
        }
        return false;
      }
      function hasWebp(dir: string): boolean {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (e.isDirectory()) { if (hasWebp(path.join(dir, e.name))) return true; }
          else if (e.name.toLowerCase().endsWith('.webp')) return true;
        }
        return false;
      }
      projectIsWebp = !hasPng(stagingImgDir) && hasWebp(stagingImgDir);
    }

    if (opts.convertWebp && !projectIsWebp) {
      onEvent({ type: 'status', phase: 'patching' });
      onEvent({ type: 'log', message: '── WebP 변환 중 ──' });
      const webpCount = await convertImagesToWebP(stagingDir, onEvent);
      onEvent({ type: 'log', message: `✓ WebP 변환 완료 (${webpCount}개)` });
      projectIsWebp = webpCount > 0;
    } else if (projectIsWebp) {
      onEvent({ type: 'log', message: '✓ 이미 WebP로 변환된 프로젝트 — 변환 생략' });
    }

    applyIndexHtmlRename(stagingDir);
    // 프로젝트가 WebP면 convertWebp 플래그를 강제 활성화
    applyCacheBusting(stagingDir, makeBuildId(), { ...opts, convertWebp: projectIsWebp || opts.convertWebp });

    onEvent({ type: 'status', phase: 'zipping' });
    onEvent({ type: 'log', message: '── ZIP 압축 중 ──' });
    const safeName = (gameTitle || 'game').replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
    const zipPath = path.join(DEPLOYS_DIR, `${safeName}.zip`);
    await zipStagingWithProgress(stagingDir, zipPath, total, (cur, tot, name) => {
      onEvent({ type: 'zip-progress', current: cur, total: tot, name });
    });
    onEvent({ type: 'log', message: '✓ ZIP 완료' });

    return zipPath;
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

// ─── ZIP 생성 + 폴더 열기 (SSE) ──────────────────────────────────────────────
router.get('/deploy-zip-progress', async (req: Request, res: Response) => {
  if (!projectManager.isOpen()) {
    res.status(404).json({ error: '프로젝트가 열려있지 않습니다' });
    return;
  }
  const opts = parseCacheBustQuery(req.query as Record<string, unknown>);
  setupSSE(res);
  try {
    const zipPath = await buildDeployZipWithProgress(
      projectManager.currentPath!,
      getGameTitle(),
      opts,
      (data) => sseWrite(res, data),
    );
    openInExplorer(DEPLOYS_DIR);
    sseWrite(res, { type: 'done', zipPath });
  } catch (err) {
    sseWrite(res, { type: 'error', message: (err as Error).message });
  }
  res.end();
});

// ─── deploys 폴더 열기 ────────────────────────────────────────────────────────
router.post('/open-deploys-dir', (_req: Request, res: Response) => {
  fs.mkdirSync(DEPLOYS_DIR, { recursive: true });
  openInExplorer(DEPLOYS_DIR);
  res.json({ success: true, path: DEPLOYS_DIR });
});

// ─── Netlify 자동 배포 (SSE) ──────────────────────────────────────────────────
router.post('/deploy-netlify-progress', async (req: Request, res: Response) => {
  if (!projectManager.isOpen()) {
    res.status(404).json({ error: '프로젝트가 열려있지 않습니다' });
    return;
  }
  const { apiKey, siteId: inputSiteId, cacheBust } = req.body as {
    apiKey?: string;
    siteId?: string;
    cacheBust?: CacheBustOptions;
  };
  if (!apiKey?.trim()) {
    res.status(400).json({ error: 'API Key가 필요합니다' });
    return;
  }
  const opts: CacheBustOptions = cacheBust ?? {};
  setupSSE(res);
  try {
    const gameTitle = getGameTitle();
    let resolvedSiteId = inputSiteId?.trim() || '';

    if (!resolvedSiteId) {
      sseWrite(res, { type: 'status', phase: 'creating-site' });
      sseWrite(res, { type: 'log', message: '── 사이트 생성 중 ──' });
      const siteName = toNetlifySiteName(gameTitle);
      const site = await netlifyCreateSite(apiKey.trim(), siteName);
      resolvedSiteId = site.id;
      const current = settingsManager.get();
      settingsManager.update({ netlify: { ...current.netlify, siteId: resolvedSiteId } });
      sseWrite(res, { type: 'site-created', siteId: resolvedSiteId, siteName: site.name });
      sseWrite(res, { type: 'log', message: `✓ 사이트 생성: ${site.name}.netlify.app` });
    }

    const zipPath = await buildDeployZipWithProgress(
      projectManager.currentPath!,
      gameTitle,
      opts,
      (data) => sseWrite(res, data),
    );
    sseWrite(res, { type: 'status', phase: 'uploading' });
    sseWrite(res, { type: 'log', message: '── Netlify 업로드 중 ──' });
    const result = await netlifyUpload(apiKey.trim(), resolvedSiteId, zipPath, (sent, total) => {
      sseWrite(res, { type: 'upload-progress', sent, total });
    });
    const deployUrl = result.deploy_ssl_url || result.ssl_url || result.url || '';
    const siteUrl = result.ssl_url || result.url || '';
    const current2 = settingsManager.get();
    settingsManager.update({ netlify: { ...current2.netlify, siteUrl } });
    sseWrite(res, { type: 'log', message: `✓ 배포 완료: ${deployUrl}` });
    sseWrite(res, { type: 'done', deployUrl, siteUrl, deployId: result.id });
  } catch (err) {
    sseWrite(res, { type: 'error', message: (err as Error).message });
  }
  res.end();
});

function openUrl(url: string) {
  if (process.platform === 'darwin') {
    exec(`open "${url}"`);
  } else if (process.platform === 'win32') {
    exec(`start "" "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

router.post('/open-netlify-drop', (_req: Request, res: Response) => {
  openUrl('https://app.netlify.com/drop');
  res.json({ success: true });
});

router.post('/open-url', (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };
  if (!url || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  openUrl(url);
  res.json({ success: true });
});

router.put('/netlify-settings', (req: Request, res: Response) => {
  const { apiKey, siteId } = req.body as { apiKey?: string; siteId?: string };
  const current = settingsManager.get();
  settingsManager.update({ netlify: { ...current.netlify, apiKey: apiKey || '', siteId: siteId || '' } });
  res.json({ success: true });
});

export default router;
