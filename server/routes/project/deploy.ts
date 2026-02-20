import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { exec } from 'child_process';
import projectManager from '../../services/projectManager';
import settingsManager from '../../services/settingsManager';
import { openInExplorer } from './helpers';

const router = express.Router();

const DEPLOYS_DIR = path.join(os.homedir(), '.rpg-editor', 'deploys');
const EXCLUDE_DIRS = new Set(['save', '.git', 'node_modules']);
const EXCLUDE_FILES = new Set(['.DS_Store', 'Thumbs.db', 'Game.rpgproject']);

function copyForDeploy(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (EXCLUDE_FILES.has(entry.name)) continue;
    if (entry.isDirectory() && EXCLUDE_DIRS.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyForDeploy(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

async function buildDeployZip(srcPath: string, gameTitle: string): Promise<string> {
  fs.mkdirSync(DEPLOYS_DIR, { recursive: true });

  // 스테이징 디렉토리에 파일 복사
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rpgdeploy-'));
  try {
    copyForDeploy(srcPath, stagingDir);

    // index_3d.html → index.html 처리
    const idx3d = path.join(stagingDir, 'index_3d.html');
    const idxMain = path.join(stagingDir, 'index.html');
    const idxPixi = path.join(stagingDir, 'index_pixi.html');
    if (fs.existsSync(idxMain) && !fs.existsSync(idxPixi)) {
      fs.renameSync(idxMain, idxPixi);
    }
    if (fs.existsSync(idx3d)) {
      fs.renameSync(idx3d, idxMain);
    }

    const safeName = (gameTitle || 'game').replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
    const zipPath = path.join(DEPLOYS_DIR, `${safeName}.zip`);

    // 기존 zip 삭제 후 재생성
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

    await new Promise<void>((resolve, reject) => {
      exec(`zip -r "${zipPath}" .`, { cwd: stagingDir }, (err) => {
        if (err) reject(err); else resolve();
      });
    });

    return zipPath;
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

function netlifyUpload(apiKey: string, siteId: string, zipPath: string): Promise<{ id: string; deploy_ssl_url?: string; ssl_url?: string; url?: string }> {
  return new Promise((resolve, reject) => {
    const stat = fs.statSync(zipPath);
    const fileStream = fs.createReadStream(zipPath);

    const options: https.RequestOptions = {
      hostname: 'api.netlify.com',
      path: `/api/v1/sites/${siteId}/deploys`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/zip',
        'Content-Length': stat.size,
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
    fileStream.pipe(req);
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

// ZIP 생성 + 폴더 열기
router.post('/deploy-zip', async (req: Request, res: Response) => {
  if (!projectManager.isOpen()) {
    return res.status(404).json({ error: '프로젝트가 열려있지 않습니다' });
  }
  try {
    const gameTitle = getGameTitle();
    const zipPath = await buildDeployZip(projectManager.currentPath!, gameTitle);
    openInExplorer(DEPLOYS_DIR);
    res.json({ success: true, zipPath });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Netlify 자동 배포
router.post('/deploy-netlify', async (req: Request, res: Response) => {
  if (!projectManager.isOpen()) {
    return res.status(404).json({ error: '프로젝트가 열려있지 않습니다' });
  }

  const { apiKey, siteId } = req.body as { apiKey?: string; siteId?: string };
  if (!apiKey?.trim() || !siteId?.trim()) {
    return res.status(400).json({ error: 'API Key와 Site ID가 필요합니다' });
  }

  try {
    const gameTitle = getGameTitle();
    const zipPath = await buildDeployZip(projectManager.currentPath!, gameTitle);
    const result = await netlifyUpload(apiKey.trim(), siteId.trim(), zipPath);
    const deployUrl = result.deploy_ssl_url || result.ssl_url || result.url || '';
    res.json({ success: true, deployUrl, deployId: result.id });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
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
  settingsManager.update({ netlify: { apiKey: apiKey || '', siteId: siteId || '' } });
  res.json({ success: true });
});

export default router;
