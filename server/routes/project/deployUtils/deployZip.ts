import fs from 'fs';
import path from 'path';
import os from 'os';
import archiver from 'archiver';
import sharp from 'sharp';
import projectManager from '../../../services/projectManager';
import { collectUsedAssetNames, collectFilesForDeploy } from './assetFilter';
import { syncRuntimeFiles, applyIndexHtmlRename } from './runtimeSync';
import { CacheBustOptions, applyCacheBusting, makeBuildId } from './cacheBusting';
import { generateBundleFiles, collectBundleEntries, BundleFileEntry } from './bundleGen';

/** @deprecated 직접 사용하지 말 것 — getDeploysDir(projectPath) 사용 */
export const DEPLOYS_DIR = path.join(os.homedir(), '.rpg-editor', 'deploys');

export function getDeploysDir(projectPath: string): string {
  return path.join(projectPath, 'deploy');
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

/** staging의 data/Map*.json에서 __ref 마커를 외부 파일로 인라인 병합 */
function inlineEventRefs(stagingDir: string): void {
  const dataDir = path.join(stagingDir, 'data');
  if (!fs.existsSync(dataDir)) return;
  for (const file of fs.readdirSync(dataDir)) {
    if (!/^Map\d+\.json$/i.test(file)) continue;
    const filePath = path.join(dataDir, file);
    let data: Record<string, unknown>;
    try { data = JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { continue; }
    if (!Array.isArray(data.events)) continue;
    let modified = false;
    data.events = (data.events as Record<string, unknown>[]).map((ev) => {
      if (!ev || !ev.__ref) return ev;
      const refPath = path.join(dataDir, String(ev.__ref));
      const { __ref: _r, ...rest } = ev;
      modified = true;
      if (!fs.existsSync(refPath)) return rest;
      try {
        const ext = JSON.parse(fs.readFileSync(refPath, 'utf-8'));
        return { ...rest, note: ext.note ?? rest.note, pages: ext.pages ?? [] };
      } catch { return rest; }
    });
    if (modified) fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
  }
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = (ms / 1000).toFixed(1);
  return `${s}s`;
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

    inlineEventRefs(stagingDir);
    endPhase('이벤트 외부파일 인라인');

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

    // ── ZIP 크기 표시 ──
    const zipSizeBytes = fs.statSync(zipPath).size;
    const zipSizeMB = (zipSizeBytes / 1048576).toFixed(1);
    const zipSizeGB = (zipSizeBytes / 1073741824).toFixed(2);
    onEvent({ type: 'log', message: `✓ ZIP 크기: ${zipSizeMB} MB (${zipSizeGB} GB)` });

    // ── 단계별 소요 시간 요약 ──
    const totalMs = Date.now() - t0;
    onEvent({ type: 'log', message: '── 단계별 소요 시간 ──' });
    for (const p of phases) {
      onEvent({ type: 'log', message: `  ${p.name}: ${fmtMs(p.ms)}` });
    }
    onEvent({ type: 'log', message: `  합계: ${fmtMs(totalMs)}` });

    return zipPath;
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}
