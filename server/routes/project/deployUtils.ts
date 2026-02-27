import fs from 'fs';
import path from 'path';
import os from 'os';
import { Response } from 'express';
import archiver from 'archiver';
import sharp from 'sharp';
import projectManager from '../../services/projectManager';

/** @deprecated 직접 사용하지 말 것 — getDeploysDir(projectPath) 사용 */
export const DEPLOYS_DIR = path.join(os.homedir(), '.rpg-editor', 'deploys');
export function getDeploysDir(projectPath: string): string {
  return path.join(projectPath, 'deploy');
}
// Generator: 에디터 전용 캐릭터 생성기 에셋, 웹 배포에 불필요
export const EXCLUDE_DIRS_LOWER = new Set(['save', '.git', 'node_modules', 'generator']);
export const EXCLUDE_FILES = new Set(['.DS_Store', 'Thumbs.db', 'Game.rpgproject']);

// ─── 캐시 버스팅 옵션 ─────────────────────────────────────────────────────────
export interface CacheBustOptions {
  scripts?:      boolean;
  images?:       boolean;
  audio?:        boolean;
  video?:        boolean;
  data?:         boolean;
  filterUnused?: boolean;
  convertWebp?:  boolean;
  bundle?:       boolean;
}

// ─── 미사용 에셋 필터링 ───────────────────────────────────────────────────────

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

  const dataDir = path.join(projectPath, 'data');
  if (fs.existsSync(dataDir)) {
    for (const file of fs.readdirSync(dataDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        extractStringValues(JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')), names);
      } catch {}
    }
  }

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

/** 배포할 파일 목록을 상대경로 배열로 반환 */
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

    html = html.replace(
      '<head>',
      `<head>\n    <script>window.__BUILD_ID__='${buildId}';window.__CACHE_BUST__=${cb};</script>`,
    );

    fs.writeFileSync(htmlPath, html, 'utf-8');
  }
}

const BUNDLE_MAX_BYTES = 99 * 1024 * 1024;

interface BundleFileEntry {
  absPath: string;
  zipName: string;
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
    const archive = archiver('zip', { zlib: { level: 0 } });
    archive.on('error', reject);
    output.on('close', resolve);
    archive.pipe(output);
    for (const e of entries) archive.file(e.absPath, { name: e.zipName });
    archive.finalize();
  });
}

/** 배포 디렉터리에 SW 번들 파일 생성
 * @param extDirs staging에 없는 디렉터리 항목 (img/, audio/ 등 직접 스트리밍용)
 */
export async function generateBundleFiles(
  stagingDir: string,
  buildId: string,
  log?: (msg: string) => void,
  extDirs?: Map<string, BundleFileEntry[]>,
): Promise<void> {
  const l = (msg: string) => { if (log) log(msg); };
  l('── SW 번들 ZIP 생성 ──');

  const bundlesDir = path.join(stagingDir, 'bundles');
  fs.mkdirSync(bundlesDir, { recursive: true });

  const manifestBundles: { file: string; prefix: string }[] = [];

  for (const dir of ['img', 'audio', 'data']) {
    let entries: BundleFileEntry[];
    if (extDirs?.has(dir)) {
      entries = extDirs.get(dir)!;
    } else {
      const dirPath = path.join(stagingDir, dir);
      if (!fs.existsSync(dirPath)) continue;
      entries = collectBundleEntries(dirPath);
    }
    if (entries.length === 0) continue;
    const prefix = `${dir}/`;

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

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jszipPath: string = require.resolve('jszip/dist/jszip.min.js');
  fs.copyFileSync(jszipPath, path.join(bundlesDir, 'jszip.min.js'));

  fs.writeFileSync(
    path.join(bundlesDir, 'manifest.json'),
    JSON.stringify({ version: buildId, bundles: manifestBundles }),
    'utf-8',
  );

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

/** query string에서 CacheBustOptions 파싱 */
export function parseCacheBustQuery(query: Record<string, unknown>): CacheBustOptions {
  const flag = (key: string) => query[key] !== '0';
  return {
    scripts: flag('cbScripts'),
    images:  flag('cbImages'),
    audio:   flag('cbAudio'),
    video:   flag('cbVideo'),
    data:    flag('cbData'),
    filterUnused: query['cbFilterUnused'] === '1' || query['filterUnused'] === true,
    convertWebp: query['cbConvertWebp'] === '1' || query['convertWebp'] === true,
    bundle: query['bundle'] === '1' || query['bundle'] === true,
  };
}

/** img/ 하위 PNG 파일을 WebP lossless로 변환하고 원본 삭제 */
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
    onEvent({ type: 'progress', current: converted, total });
    const webpPath = pngPath.slice(0, -4) + '.webp';
    await sharp(pngPath).webp({ lossless: true }).toFile(webpPath);
    fs.unlinkSync(pngPath);
    converted++;
    onEvent({ type: 'log', message: `  ${filename} (성공)` });
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
  directEntries: { src: string; name: string }[] = [],
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
    // staging에 없는 파일들(img/, audio/)을 원본에서 직접 스트리밍
    for (const e of directEntries) archive.file(e.src, { name: e.name });
    if (excludeDirs.length > 0) {
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

export function getGameTitle(): string {
  if (!projectManager.isOpen()) return 'game';
  try {
    const system = projectManager.readJSON('System.json') as { gameTitle?: string };
    return system.gameTitle || 'game';
  } catch {
    return 'game';
  }
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = (ms / 1000).toFixed(1);
  return `${s}s`;
}

/** 파일 복사 + ZIP 생성 공통 로직 (SSE 프로그레스 콜백 포함) */
export async function buildDeployZipWithProgress(
  srcPath: string,
  gameTitle: string,
  opts: CacheBustOptions,
  onEvent: (data: object) => void,
): Promise<string> {
  const deploysDir = getDeploysDir(srcPath);
  fs.mkdirSync(deploysDir, { recursive: true });

  const t0 = Date.now();
  const phases: { name: string; ms: number }[] = [];
  let tPhase = t0;
  const endPhase = (name: string) => {
    phases.push({ name, ms: Date.now() - tPhase });
    tPhase = Date.now();
  };

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

  // img/, audio/: 수천 개의 바이너리 파일 — staging 복사 생략, 직접 스트리밍
  // WebP 변환이 필요한 경우에만 img/를 staging에 복사
  const LARGE_DIRS = ['img', 'audio'];
  const stagingFiles: string[] = [];
  const largeFiles: string[] = [];
  for (const rel of files) {
    if (LARGE_DIRS.includes(rel.split('/')[0].toLowerCase())) largeFiles.push(rel);
    else stagingFiles.push(rel);
  }

  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rpgdeploy-'));
  try {
    let current = 0;
    for (const rel of stagingFiles) {
      const destFile = path.join(stagingDir, rel);
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(path.join(srcPath, rel), destFile);
      current++;
      if (current % 20 === 0 || current === stagingFiles.length) {
        onEvent({ type: 'progress', current, total });
      }
    }
    onEvent({ type: 'log', message: '✓ 복사 완료' });
    endPhase('파일 복사');

    syncRuntimeFiles(stagingDir);
    endPhase('런타임 동기화');

    // WebP 여부는 원본 img/ 디렉터리에서 확인
    const srcImgDir = path.join(srcPath, 'img');
    let projectIsWebp = false;
    if (fs.existsSync(srcImgDir)) {
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
      projectIsWebp = !hasPng(srcImgDir) && hasWebp(srcImgDir);
    }

    // WebP 변환: PNG마다 같은 경로에 WebP가 이미 있으면 스킵, 없으면 변환
    let imgInStaging = false;
    const imgWebpSrcRels: string[] = []; // staging에 없는 원본 WebP 파일들
    let effectiveLargeFiles = largeFiles; // 스킵된 PNG 제거 후 버전
    if (opts.convertWebp && !projectIsWebp) {
      const allImgPngRels = largeFiles.filter(r => r.startsWith('img/') && r.toLowerCase().endsWith('.png'));
      imgWebpSrcRels.push(...largeFiles.filter(r => r.startsWith('img/') && !r.toLowerCase().endsWith('.png')));
      // 같은 이름의 WebP가 이미 있는 PNG는 스킵
      const existingWebpBases = new Set(imgWebpSrcRels.map(r => r.slice(0, r.lastIndexOf('.'))));
      const imgPngToConvert = allImgPngRels.filter(r => !existingWebpBases.has(r.slice(0, r.lastIndexOf('.'))));
      const imgPngSkipped  = allImgPngRels.filter(r =>  existingWebpBases.has(r.slice(0, r.lastIndexOf('.'))));
      if (allImgPngRels.length > 0) {
        onEvent({ type: 'status', phase: 'patching' });
        onEvent({ type: 'log', message: '── WebP 변환 중 ──' });
        for (const rel of imgPngSkipped) {
          onEvent({ type: 'log', message: `  ${rel.slice(4)} (스킵됨)` });
        }
        if (imgPngToConvert.length > 0) {
          for (const rel of imgPngToConvert) {
            const dest = path.join(stagingDir, rel);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(path.join(srcPath, rel), dest);
          }
          const webpCount = await convertImagesToWebP(stagingDir, onEvent);
          onEvent({ type: 'log', message: `✓ WebP 변환 완료 (${webpCount}개 변환, ${imgPngSkipped.length}개 스킵됨)` });
          projectIsWebp = webpCount > 0;
          imgInStaging = webpCount > 0;
        } else {
          onEvent({ type: 'log', message: `✓ 전체 스킵됨 — WebP 파일이 이미 존재합니다 (${imgPngSkipped.length}개)` });
        }
        // 대응 WebP가 있는 PNG는 archive/bundle에서 제외
        if (imgPngSkipped.length > 0) {
          const skipSet = new Set(imgPngSkipped);
          effectiveLargeFiles = largeFiles.filter(r => !skipSet.has(r));
        }
        endPhase('WebP 변환');
      }
    } else if (projectIsWebp) {
      onEvent({ type: 'log', message: '✓ 이미 WebP로 변환된 프로젝트 — 변환 생략' });
    }

    applyIndexHtmlRename(stagingDir);
    const buildId = makeBuildId();
    applyCacheBusting(stagingDir, buildId, { ...opts, convertWebp: projectIsWebp || opts.convertWebp });
    endPhase('캐시 버스팅');

    if (opts.bundle) {
      const extDirs = new Map<string, BundleFileEntry[]>();
      // img/: staging 변환 파일(PNG→WebP) + srcPath 원본 WebP 파일 합산
      const imgExtEntries: BundleFileEntry[] = [];
      if (imgInStaging) {
        const stagingImgDir = path.join(stagingDir, 'img');
        if (fs.existsSync(stagingImgDir)) imgExtEntries.push(...collectBundleEntries(stagingImgDir));
      }
      const imgSrcRels = imgInStaging
        ? imgWebpSrcRels                                        // 변환됐으면 원본 WebP만
        : effectiveLargeFiles.filter(r => r.startsWith('img/')); // 스킵된 PNG 제외
      for (const rel of imgSrcRels) {
        imgExtEntries.push({ absPath: path.join(srcPath, rel), zipName: rel.slice(4), size: fs.statSync(path.join(srcPath, rel)).size });
      }
      if (imgExtEntries.length > 0) extDirs.set('img', imgExtEntries);
      const audioEntries = effectiveLargeFiles
        .filter(r => r.startsWith('audio/'))
        .map(r => ({ absPath: path.join(srcPath, r), zipName: r.slice(6), size: fs.statSync(path.join(srcPath, r)).size }));
      if (audioEntries.length > 0) extDirs.set('audio', audioEntries);
      await generateBundleFiles(stagingDir, buildId, (msg) => onEvent({ type: 'log', message: msg }), extDirs.size > 0 ? extDirs : undefined);
      endPhase('번들 생성');
    }

    onEvent({ type: 'status', phase: 'zipping' });
    onEvent({ type: 'log', message: '── ZIP 압축 중 ──' });
    const safeName = (gameTitle || 'game').replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
    const zipPath = path.join(deploysDir, `${safeName}.zip`);
    const zipExcludeDirs = opts.bundle ? ['img', 'audio', 'data'] : [];
    // bundle=false: img/audio를 srcPath에서 직접 스트리밍
    // imgInStaging=true인 경우 PNG→WebP 변환된 파일은 staging에 있으므로 archive.directory가 처리,
    // srcPath의 원본 WebP 파일(imgWebpSrcRels)만 directEntries에 추가
    const imgWebpSrcSet = new Set(imgWebpSrcRels);
    const directEntries: { src: string; name: string }[] = [];
    if (!opts.bundle) {
      for (const rel of effectiveLargeFiles) {  // 스킵된 PNG 이미 제외됨
        if (rel.startsWith('img/') && imgInStaging && !imgWebpSrcSet.has(rel)) continue;
        directEntries.push({ src: path.join(srcPath, rel), name: rel });
      }
    }
    await zipStagingWithProgress(stagingDir, zipPath, total, (cur, tot, name) => {
      onEvent({ type: 'zip-progress', current: cur, total: tot, name });
    }, zipExcludeDirs, directEntries);
    endPhase('ZIP 압축');
    onEvent({ type: 'log', message: '✓ ZIP 완료' });

    // ── 단계별 소요 시간 요약 ──
    const totalMs = Date.now() - t0;
    const lines = ['── 소요 시간 ──'];
    for (const p of phases) {
      lines.push(`  ${p.name}: ${fmtMs(p.ms)}`);
    }
    lines.push(`  합계: ${fmtMs(totalMs)}`);
    onEvent({ type: 'log', message: lines.join('\n') });

    return zipPath;
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}
