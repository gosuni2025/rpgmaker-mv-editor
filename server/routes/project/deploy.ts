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
  bundle?:       boolean; // SW 번들 ZIP 생성 (img/audio/data → ZIP)
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

/**
 * 런타임 JS 파일을 대상 디렉터리에 동기화.
 * server/runtime/js/ → destRoot/js/3d/ (plugins 제외)
 * server/runtime/js/libs/ → destRoot/js/libs/
 * server/runtime/index_3d.html → destRoot/index_3d.html
 */
export function syncRuntimeFiles(destRoot: string): void {
  const runtimeJsDir = path.resolve(__dirname, '../../runtime/js');
  if (!fs.existsSync(runtimeJsDir)) return;

  function copyDir(srcDir: string, destDir: string) {
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      const srcFull = path.join(srcDir, entry.name);
      const destFull = path.join(destDir, entry.name);
      // plugins/ 는 프로젝트 것 그대로 사용
      const rel = path.relative(runtimeJsDir, srcFull);
      if (rel === 'plugins' || rel.startsWith('plugins' + path.sep) || rel === 'plugins.js') continue;
      if (entry.isDirectory()) {
        fs.mkdirSync(destFull, { recursive: true });
        copyDir(srcFull, destFull);
      } else {
        fs.mkdirSync(path.dirname(destFull), { recursive: true });
        fs.copyFileSync(srcFull, destFull);
      }
    }
  }

  const js3dDir = path.join(destRoot, 'js', '3d');
  fs.mkdirSync(js3dDir, { recursive: true });

  for (const entry of fs.readdirSync(runtimeJsDir, { withFileTypes: true })) {
    if (entry.name === 'plugins' || entry.name === 'plugins.js') continue;
    const srcFull = path.join(runtimeJsDir, entry.name);
    if (entry.name === 'libs') {
      // libs/ → destRoot/js/libs/ (three.global.min.js 등, PIXI 파일은 이미 있으므로 덮어쓰기만)
      const destFull = path.join(destRoot, 'js', 'libs');
      fs.mkdirSync(destFull, { recursive: true });
      if (entry.isDirectory()) copyDir(srcFull, destFull);
    } else {
      const destFull = path.join(js3dDir, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destFull, { recursive: true });
        copyDir(srcFull, destFull);
      } else {
        fs.copyFileSync(srcFull, destFull);
      }
    }
  }

  // index_3d.html 덮어씌움
  const runtimeIdx3d = path.resolve(__dirname, '../../runtime/index_3d.html');
  if (fs.existsSync(runtimeIdx3d)) {
    fs.copyFileSync(runtimeIdx3d, path.join(destRoot, 'index_3d.html'));
  }
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

const BUNDLE_MAX_BYTES = 99 * 1024 * 1024; // 99 MB

interface BundleFileEntry {
  absPath: string;
  zipName: string; // ZIP 내 상대경로 (디렉터리 prefix 없음)
  size: number;
}

function collectBundleEntries(dirPath: string): BundleFileEntry[] {
  const result: BundleFileEntry[] = [];
  function walk(dir: string, prefix: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(full, rel);
      } else {
        result.push({ absPath: full, zipName: rel, size: fs.statSync(full).size });
      }
    }
  }
  walk(dirPath, '');
  return result;
}

async function writeZip(zipPath: string, entries: BundleFileEntry[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 0 } }); // store-only
    archive.on('error', reject);
    output.on('close', resolve);
    archive.pipe(output);
    for (const e of entries) archive.file(e.absPath, { name: e.zipName });
    archive.finalize();
  });
}

/** 배포 디렉터리에 SW 번들 파일 생성:
 *  - bundles/<dir>.zip, <dir>_2.zip ... (99MB 단위 분할, store-only)
 *  - bundles/manifest.json  { version, bundles: [{ file, prefix }] }
 *  - bundles/jszip.min.js
 *  - sw.js (buildId 주석 주입)
 */
export async function generateBundleFiles(
  stagingDir: string,
  buildId: string,
  log?: (msg: string) => void,
): Promise<void> {
  const l = (msg: string) => { if (log) log(msg); };
  l('── SW 번들 ZIP 생성 ──');

  const bundlesDir = path.join(stagingDir, 'bundles');
  fs.mkdirSync(bundlesDir, { recursive: true });

  const manifestBundles: { file: string; prefix: string }[] = [];

  for (const dir of ['img', 'audio', 'data']) {
    const dirPath = path.join(stagingDir, dir);
    if (!fs.existsSync(dirPath)) continue;

    const entries = collectBundleEntries(dirPath);
    const prefix = `${dir}/`;

    // 99MB 단위로 분할
    const chunks: BundleFileEntry[][] = [];
    let chunk: BundleFileEntry[] = [];
    let chunkSize = 0;
    for (const entry of entries) {
      if (chunk.length > 0 && chunkSize + entry.size > BUNDLE_MAX_BYTES) {
        chunks.push(chunk);
        chunk = [];
        chunkSize = 0;
      }
      chunk.push(entry);
      chunkSize += entry.size;
    }
    if (chunk.length > 0) chunks.push(chunk);

    for (let i = 0; i < chunks.length; i++) {
      const fileName = i === 0 ? `${dir}.zip` : `${dir}_${i + 1}.zip`;
      const zipPath = path.join(bundlesDir, fileName);
      const sizeMb = (chunks[i].reduce((s, e) => s + e.size, 0) / 1024 / 1024).toFixed(1);
      l(`  ${dir}/ → bundles/${fileName} (${sizeMb} MB, ${chunks[i].length}개 파일)`);
      await writeZip(zipPath, chunks[i]);
      manifestBundles.push({ file: fileName, prefix });
    }
  }

  // jszip.min.js 복사
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jszipPath: string = require.resolve('jszip/dist/jszip.min.js');
  fs.copyFileSync(jszipPath, path.join(bundlesDir, 'jszip.min.js'));

  // manifest.json
  fs.writeFileSync(
    path.join(bundlesDir, 'manifest.json'),
    JSON.stringify({ version: buildId, bundles: manifestBundles }),
    'utf-8',
  );

  // sw.js 복사 + buildId 주석 주입 (배포마다 파일이 달라져 SW 재설치 트리거)
  const swSrcPath = path.resolve(__dirname, '../../runtime/sw.js');
  if (fs.existsSync(swSrcPath)) {
    const swContent = `// build: ${buildId}\n` + fs.readFileSync(swSrcPath, 'utf-8');
    fs.writeFileSync(path.join(stagingDir, 'sw.js'), swContent, 'utf-8');
  }

  l(`✓ 번들 ZIP 생성 완료 (${manifestBundles.length}개 파일)`);
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
    // GET: bundle=1, POST body: bundle=true
    bundle: query['bundle'] === '1' || query['bundle'] === true,
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
  excludeDirs: string[] = [],
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
    if (excludeDirs.length > 0) {
      // 제외 폴더를 뺀 나머지 항목만 추가
      for (const entry of fs.readdirSync(stagingDir, { withFileTypes: true })) {
        if (entry.isDirectory() && excludeDirs.includes(entry.name)) continue;
        const full = path.join(stagingDir, entry.name);
        if (entry.isDirectory()) archive.directory(full, entry.name);
        else archive.file(full, { name: entry.name });
      }
    } else {
      archive.directory(stagingDir, false);
    }
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

    // 런타임 JS 파일 동기화 (js/3d/, js/libs/, index_3d.html)
    // 프로젝트 js/3d/가 구버전이어도 배포에는 항상 최신 런타임이 포함됨
    syncRuntimeFiles(stagingDir);

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
    const buildId = makeBuildId();
    applyCacheBusting(stagingDir, buildId, { ...opts, convertWebp: projectIsWebp || opts.convertWebp });
    if (opts.bundle) {
      await generateBundleFiles(stagingDir, buildId, (msg) => onEvent({ type: 'log', message: msg }));
    }

    onEvent({ type: 'status', phase: 'zipping' });
    onEvent({ type: 'log', message: '── ZIP 압축 중 ──' });
    const safeName = (gameTitle || 'game').replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
    const zipPath = path.join(DEPLOYS_DIR, `${safeName}.zip`);
    const zipExcludeDirs = opts.bundle ? ['img', 'audio', 'data'] : [];
    await zipStagingWithProgress(stagingDir, zipPath, total, (cur, tot, name) => {
      onEvent({ type: 'zip-progress', current: cur, total: tot, name });
    }, zipExcludeDirs);
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
