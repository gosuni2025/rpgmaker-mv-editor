import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import projectManager from '../../services/projectManager';
import settingsManager from '../../services/settingsManager';
import {
  collectFilesForDeploy,
  applyIndexHtmlRename,
  applyCacheBusting,
  makeBuildId,
  setupSSE,
  sseWrite,
  parseCacheBustQuery,
  CacheBustOptions,
} from './deploy';

const router = express.Router();
const execAsync = promisify(exec);

/** staging 디렉터리 루트: ~/.rpg-editor/gh-deploy/<remoteUrl-hash>/ */
const GH_DEPLOY_BASE = path.join(os.homedir(), '.rpg-editor', 'gh-deploy');

// ─── 유틸 ────────────────────────────────────────────────────────────────────

/** gh CLI 설치 여부 확인 */
async function checkGhCli(): Promise<boolean> {
  try { await execAsync('which gh'); return true; } catch {}
  try { await execAsync('gh --version'); return true; } catch {}
  return false;
}

/** 경로가 유효한 git 저장소인지 확인 */
async function checkGitRepo(repoPath: string): Promise<boolean> {
  if (!repoPath || !fs.existsSync(repoPath)) return false;
  try { await execAsync(`git -C "${repoPath}" rev-parse --git-dir`); return true; } catch { return false; }
}

/** git remote URL에서 GitHub Pages URL 추출 */
function derivePageUrl(remoteUrl: string): string {
  const m = remoteUrl.trim()
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '')
    .match(/github\.com\/([^/]+)\/(.+)/);
  if (!m) return '';
  return `https://${m[1]}.github.io/${m[2]}`;
}

/** 프로젝트의 모든 remote 목록 */
async function getRemotes(repoPath: string): Promise<{ name: string; url: string }[]> {
  try {
    const { stdout } = await execAsync(`git -C "${repoPath}" remote`);
    const names = stdout.trim().split('\n').filter(Boolean);
    const result: { name: string; url: string }[] = [];
    for (const name of names) {
      try {
        const { stdout: u } = await execAsync(`git -C "${repoPath}" remote get-url ${name}`);
        result.push({ name, url: u.trim() });
      } catch { result.push({ name, url: '' }); }
    }
    return result;
  } catch { return []; }
}

/** 특정 remote의 URL */
async function getRemoteUrl(repoPath: string, remote: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`git -C "${repoPath}" remote get-url ${remote}`);
    return stdout.trim();
  } catch { return ''; }
}

/** remoteUrl 기반 staging 디렉터리 경로 */
function getStagingDir(remoteUrl: string): string {
  const hash = crypto.createHash('md5').update(remoteUrl).digest('hex').slice(0, 12);
  return path.join(GH_DEPLOY_BASE, hash);
}

/**
 * staging 디렉터리 준비
 * - 없으면 git clone
 * - 있으면 remote URL만 최신화
 */
function ensureStagingDir(stagingDir: string, remoteUrl: string): void {
  if (!fs.existsSync(stagingDir)) {
    fs.mkdirSync(path.dirname(stagingDir), { recursive: true });
    execSync(`git clone "${remoteUrl}" "${stagingDir}"`, { stdio: 'pipe' });
  } else {
    try { execSync(`git -C "${stagingDir}" remote set-url origin "${remoteUrl}"`, { stdio: 'pipe' }); } catch {}
  }
}

// ─── 사전 조건 체크 ───────────────────────────────────────────────────────────
router.get('/deploy-ghpages-check', async (_req: Request, res: Response) => {
  const srcPath = projectManager.currentPath || '';
  const settings = settingsManager.get();
  const selectedRemote = settings.ghPages?.remote || 'pages';

  const [ghCli, isGitRepo] = await Promise.all([checkGhCli(), checkGitRepo(srcPath)]);

  let remotes: { name: string; url: string; pageUrl: string }[] = [];
  let pageUrl = '';

  if (isGitRepo) {
    const raw = await getRemotes(srcPath);
    remotes = raw.map(r => ({ ...r, pageUrl: derivePageUrl(r.url) }));
    const sel = remotes.find(r => r.name === selectedRemote) ?? remotes[0];
    pageUrl = sel?.pageUrl ?? '';
  }

  res.json({ ghCli, isGitRepo, remotes, selectedRemote, pageUrl });
});

// ─── GitHub Pages 배포 (SSE) ──────────────────────────────────────────────────
router.get('/deploy-ghpages-progress', async (req: Request, res: Response) => {
  if (!projectManager.isOpen()) {
    res.status(404).json({ error: '프로젝트가 열려있지 않습니다' });
    return;
  }

  const settings = settingsManager.get();
  const remote = ((req.query.remote as string | undefined) || settings.ghPages?.remote || 'pages').trim();
  const srcPath = projectManager.currentPath!;
  const opts = parseCacheBustQuery(req.query as Record<string, unknown>);

  setupSSE(res);

  try {
    // ── 1. remote URL 확인 ────────────────────────────────────────────────────
    const remoteUrl = await getRemoteUrl(srcPath, remote);
    if (!remoteUrl) {
      sseWrite(res, { type: 'error', message: `remote '${remote}'를 찾을 수 없습니다. 프로젝트 폴더에서 git remote add ${remote} <URL> 을 실행해주세요.` });
      res.end();
      return;
    }

    // ── 2. staging 디렉터리 준비 (첫 배포 시 git clone) ──────────────────────
    sseWrite(res, { type: 'status', phase: 'copying' });
    const stagingDir = getStagingDir(remoteUrl);
    ensureStagingDir(stagingDir, remoteUrl);

    // ── 3. 기존 파일 정리 (.git 제외) ─────────────────────────────────────────
    for (const entry of fs.readdirSync(stagingDir)) {
      if (entry === '.git') continue;
      fs.rmSync(path.join(stagingDir, entry), { recursive: true, force: true });
    }

    // ── 4. 프로젝트 파일 복사 ─────────────────────────────────────────────────
    const files = collectFilesForDeploy(srcPath);
    const total = files.length;
    sseWrite(res, { type: 'counted', total });

    let current = 0;
    for (const rel of files) {
      const destFile = path.join(stagingDir, rel);
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(path.join(srcPath, rel), destFile);
      current++;
      if (current % 30 === 0 || current === total) {
        sseWrite(res, { type: 'progress', current, total });
      }
    }

    // ── 5. index_3d.html → index.html + 캐시 버스팅 ─────────────────────────
    // 프로젝트의 index.html(PIXI용)은 index_pixi.html로 보존하고,
    // Three.js 런타임인 index_3d.html을 index.html로 사용
    sseWrite(res, { type: 'status', phase: 'patching' });
    applyIndexHtmlRename(stagingDir);
    const buildId = makeBuildId();
    applyCacheBusting(stagingDir, buildId, opts);

    // ── 6. git commit ─────────────────────────────────────────────────────────
    sseWrite(res, { type: 'status', phase: 'committing' });
    const now = new Date().toLocaleString('ko-KR');
    const commitMsg = `Deploy: ${now}`;

    execSync(`git -C "${stagingDir}" add -A`);
    let commitHash = '';
    try {
      execSync(`git -C "${stagingDir}" commit -m "${commitMsg}"`);
      const hashResult = execSync(`git -C "${stagingDir}" rev-parse --short HEAD`, { encoding: 'utf-8' });
      commitHash = hashResult.trim();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('nothing to commit') && !msg.includes('nothing added')) throw e;
    }

    // ── 7. git push ───────────────────────────────────────────────────────────
    sseWrite(res, { type: 'status', phase: 'pushing' });
    execSync(`git -C "${stagingDir}" push`, { stdio: 'pipe' });

    const pageUrl = derivePageUrl(remoteUrl);
    sseWrite(res, { type: 'done', commitHash, pageUrl, buildId });
  } catch (err) {
    sseWrite(res, { type: 'error', message: (err as Error).message });
  }
  res.end();
});

// ─── GitHub Pages 설정 저장 ───────────────────────────────────────────────────
router.put('/ghpages-settings', (req: Request, res: Response) => {
  const { remote } = req.body as { remote?: string };
  const current = settingsManager.get();
  settingsManager.update({ ghPages: { ...current.ghPages, remote: remote || 'pages' } });
  res.json({ success: true });
});

export default router;
