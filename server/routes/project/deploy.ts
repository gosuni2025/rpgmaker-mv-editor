import express, { Request, Response } from 'express';
import fs from 'fs';
import https from 'https';
import { exec } from 'child_process';
import projectManager from '../../services/projectManager';
import settingsManager from '../../services/settingsManager';
import { openInExplorer } from './helpers';
import {
  DEPLOYS_DIR,
  CacheBustOptions,
  buildDeployZipWithProgress,
  setupSSE,
  sseWrite,
  parseCacheBustQuery,
  syncRuntimeFiles,
  getGameTitle,
} from './deployUtils';

// Re-export for use by deploy-ghpages.ts and deploy-itchio.ts
export {
  DEPLOYS_DIR,
  CacheBustOptions,
  buildDeployZipWithProgress,
  setupSSE,
  sseWrite,
  parseCacheBustQuery,
  syncRuntimeFiles,
  getGameTitle,
  collectUsedAssetNames,
  collectFilesForDeploy,
  applyIndexHtmlRename,
  applyCacheBusting,
  generateBundleFiles,
  makeBuildId,
} from './deployUtils';

const router = express.Router();

// ─── Netlify 유틸 ─────────────────────────────────────────────────────────────

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

function openUrl(url: string) {
  if (process.platform === 'darwin') {
    exec(`open "${url}"`);
  } else if (process.platform === 'win32') {
    exec(`start "" "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

// ─── ZIP 생성 + 폴더 열기 (SSE) ──────────────────────────────────────────────
router.get('/deploy-zip-progress', async (req: Request, res: Response) => {
  if (!projectManager.isOpen()) {
    res.status(404).json({ error: '프로젝트가 열려있지 않습니다' });
    return;
  }
  const opts = parseCacheBustQuery(req.query as Record<string, unknown>);
  const zipName = (req.query['zipName'] as string | undefined)?.trim() || getGameTitle();
  setupSSE(res);
  try {
    const zipPath = await buildDeployZipWithProgress(
      projectManager.currentPath!,
      zipName,
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

// ─── 런타임 → 프로젝트 js/3d/ 동기화 ────────────────────────────────────────
router.post('/sync-runtime', (req: Request, res: Response) => {
  if (!projectManager.isOpen()) {
    res.status(404).json({ error: '프로젝트가 열려있지 않습니다' });
    return;
  }
  try {
    syncRuntimeFiles(projectManager.currentPath!);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
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
