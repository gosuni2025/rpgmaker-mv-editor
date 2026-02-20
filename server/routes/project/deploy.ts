import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { exec } from 'child_process';
import archiver from 'archiver';
import projectManager from '../../services/projectManager';
import settingsManager from '../../services/settingsManager';
import { openInExplorer } from './helpers';

const router = express.Router();

const DEPLOYS_DIR = path.join(os.homedir(), '.rpg-editor', 'deploys');
// Generator: 에디터 전용 캐릭터 생성기 에셋, 웹 배포에 불필요
const EXCLUDE_DIRS = new Set(['save', '.git', 'node_modules', 'Generator']);
const EXCLUDE_FILES = new Set(['.DS_Store', 'Thumbs.db', 'Game.rpgproject']);

/** 배포할 파일 목록을 상대경로 배열로 반환 */
function collectFilesForDeploy(baseDir: string, subDir = ''): string[] {
  const currentDir = subDir ? path.join(baseDir, subDir) : baseDir;
  const results: string[] = [];
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (EXCLUDE_FILES.has(entry.name)) continue;
    const rel = subDir ? `${subDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      results.push(...collectFilesForDeploy(baseDir, rel));
    } else {
      results.push(rel);
    }
  }
  return results;
}

function applyIndexHtmlRename(stagingDir: string) {
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

/** HTML 파일에 캐시 버스팅 쿼리 및 window.__BUILD_ID__ 주입 */
function applyCacheBusting(stagingDir: string, buildId: string) {
  const htmlFiles = fs.readdirSync(stagingDir).filter((f: string) => f.endsWith('.html'));
  for (const htmlFile of htmlFiles) {
    const htmlPath = path.join(stagingDir, htmlFile);
    let html = fs.readFileSync(htmlPath, 'utf-8');
    // src="...js" 또는 href="...css" 에 ?v=buildId 삽입 (기존 쿼리 교체)
    html = html.replace(/((?:src|href)="[^"?]+\.(?:js|css))(?:\?[^"]*)?"/g,
      (_: string, base: string) => `${base}?v=${buildId}"`);
    // <head> 직후에 window.__BUILD_ID__ 전역 변수 주입
    html = html.replace('<head>', `<head>\n    <script>window.__BUILD_ID__='${buildId}';</script>`);
    fs.writeFileSync(htmlPath, html, 'utf-8');
  }
}

function makeBuildId(): string {
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

function setupSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

function sseWrite(res: Response, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
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

/** Netlify 사이트 신규 생성 */
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

    // 업로드 진행률 추적 (backpressure 고려)
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

function getGameTitle(): string {
  if (!projectManager.isOpen()) return 'game';
  try {
    const system = projectManager.readJSON('System.json') as { gameTitle?: string };
    return system.gameTitle || 'game';
  } catch {
    return 'game';
  }
}

/** 파일 복사 + ZIP 생성 공통 로직 (SSE 프로그레스 콜백 포함) */
async function buildDeployZipWithProgress(
  srcPath: string,
  gameTitle: string,
  onEvent: (data: object) => void,
): Promise<string> {
  fs.mkdirSync(DEPLOYS_DIR, { recursive: true });

  onEvent({ type: 'status', phase: 'counting' });
  const files = collectFilesForDeploy(srcPath);
  const total = files.length;
  onEvent({ type: 'counted', total });

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

    applyIndexHtmlRename(stagingDir);
    applyCacheBusting(stagingDir, makeBuildId());

    onEvent({ type: 'status', phase: 'zipping' });
    const safeName = (gameTitle || 'game').replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
    const zipPath = path.join(DEPLOYS_DIR, `${safeName}.zip`);
    await zipStagingWithProgress(stagingDir, zipPath, total, (cur, tot, name) => {
      onEvent({ type: 'zip-progress', current: cur, total: tot, name });
    });

    return zipPath;
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

// ZIP 생성 + 폴더 열기 (SSE 프로그레스)
router.get('/deploy-zip-progress', async (_req: Request, res: Response) => {
  if (!projectManager.isOpen()) {
    res.status(404).json({ error: '프로젝트가 열려있지 않습니다' });
    return;
  }
  setupSSE(res);
  try {
    const zipPath = await buildDeployZipWithProgress(
      projectManager.currentPath!,
      getGameTitle(),
      (data) => sseWrite(res, data),
    );
    openInExplorer(DEPLOYS_DIR);
    sseWrite(res, { type: 'done', zipPath });
  } catch (err) {
    sseWrite(res, { type: 'error', message: (err as Error).message });
  }
  res.end();
});

// Netlify 자동 배포 (SSE 프로그레스, POST body로 API 키 전달)
// siteId가 비어있으면 프로젝트 이름으로 사이트를 자동 생성하고 설정에 저장
router.post('/deploy-netlify-progress', async (req: Request, res: Response) => {
  if (!projectManager.isOpen()) {
    res.status(404).json({ error: '프로젝트가 열려있지 않습니다' });
    return;
  }
  const { apiKey, siteId: inputSiteId } = req.body as { apiKey?: string; siteId?: string };
  if (!apiKey?.trim()) {
    res.status(400).json({ error: 'API Key가 필요합니다' });
    return;
  }
  setupSSE(res);
  try {
    const gameTitle = getGameTitle();
    let resolvedSiteId = inputSiteId?.trim() || '';

    // Site ID가 없으면 자동 생성
    if (!resolvedSiteId) {
      sseWrite(res, { type: 'status', phase: 'creating-site' });
      const siteName = toNetlifySiteName(gameTitle);
      const site = await netlifyCreateSite(apiKey.trim(), siteName);
      resolvedSiteId = site.id;
      // 생성된 Site ID를 설정에 저장 (다음 배포에서 재사용)
      const current = settingsManager.get();
      settingsManager.update({ netlify: { ...current.netlify, siteId: resolvedSiteId } });
      sseWrite(res, { type: 'site-created', siteId: resolvedSiteId, siteName: site.name });
    }

    const zipPath = await buildDeployZipWithProgress(
      projectManager.currentPath!,
      gameTitle,
      (data) => sseWrite(res, data),
    );
    sseWrite(res, { type: 'status', phase: 'uploading' });
    const result = await netlifyUpload(apiKey.trim(), resolvedSiteId, zipPath, (sent, total) => {
      sseWrite(res, { type: 'upload-progress', sent, total });
    });
    const deployUrl = result.deploy_ssl_url || result.ssl_url || result.url || '';
    const siteUrl = result.ssl_url || result.url || '';
    // 사이트 URL을 설정에 저장 (다음에 "내 사이트 열기"에 활용)
    const current2 = settingsManager.get();
    settingsManager.update({ netlify: { ...current2.netlify, siteUrl } });
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

// Netlify 드래그앤드롭 페이지 열기
router.post('/open-netlify-drop', (_req: Request, res: Response) => {
  openUrl('https://app.netlify.com/drop');
  res.json({ success: true });
});

// 일반 URL 브라우저 열기
router.post('/open-url', (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };
  if (!url || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  openUrl(url);
  res.json({ success: true });
});

// Netlify 설정 저장
router.put('/netlify-settings', (req: Request, res: Response) => {
  const { apiKey, siteId } = req.body as { apiKey?: string; siteId?: string };
  const current = settingsManager.get();
  settingsManager.update({ netlify: { ...current.netlify, apiKey: apiKey || '', siteId: siteId || '' } });
  res.json({ success: true });
});

export default router;
