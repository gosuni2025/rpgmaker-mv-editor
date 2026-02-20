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

const DEPLOY_BRANCH = 'gh-pages';

// ─── 유틸 ────────────────────────────────────────────────────────────────────

async function checkGhCli(): Promise<boolean> {
  try { await execAsync('which gh'); return true; } catch {}
  try { await execAsync('gh --version'); return true; } catch {}
  return false;
}

async function checkGitRepo(repoPath: string): Promise<boolean> {
  if (!repoPath || !fs.existsSync(repoPath)) return false;
  try { await execAsync(`git -C "${repoPath}" rev-parse --git-dir`); return true; } catch { return false; }
}

function derivePageUrl(remoteUrl: string): string {
  const m = remoteUrl.trim()
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '')
    .match(/github\.com\/([^/]+)\/(.+)/);
  if (!m) return '';
  return `https://${m[1]}.github.io/${m[2]}`;
}

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

async function getRemoteUrl(repoPath: string, remote: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`git -C "${repoPath}" remote get-url ${remote}`);
    return stdout.trim();
  } catch { return ''; }
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

  // 로컬 프로젝트 저장소에서 worktree를 생성 — clone 불필요
  const tmpBranch = `_deploy_${crypto.randomBytes(4).toString('hex')}`;
  const tmpDir = path.join(os.tmpdir(), `rpgmv-deploy-${crypto.randomBytes(6).toString('hex')}`);

  try {
    // ── 1. remote URL 확인 ────────────────────────────────────────────────────
    const remoteUrl = await getRemoteUrl(srcPath, remote);
    if (!remoteUrl) {
      sseWrite(res, { type: 'error', message: `remote '${remote}'를 찾을 수 없습니다. git remote add ${remote} <URL> 을 실행해주세요.` });
      res.end();
      return;
    }

    // ── 2. 로컬 저장소에서 worktree 생성 (orphan — 소스 히스토리와 분리) ──────
    sseWrite(res, { type: 'status', phase: 'copying' });
    execSync(`git -C "${srcPath}" worktree add --no-checkout "${tmpDir}"`, { stdio: 'pipe' });
    execSync(`git -C "${tmpDir}" checkout --orphan ${tmpBranch}`, { stdio: 'pipe' });
    // orphan 상태이므로 staged 파일 없음 — working tree만 비워주면 됨
    for (const entry of fs.readdirSync(tmpDir)) {
      if (entry === '.git') continue;
      fs.rmSync(path.join(tmpDir, entry), { recursive: true, force: true });
    }

    // ── 3. 프로젝트 파일 복사 ─────────────────────────────────────────────────
    const files = collectFilesForDeploy(srcPath);
    const total = files.length;
    sseWrite(res, { type: 'counted', total });

    let current = 0;
    for (const rel of files) {
      const destFile = path.join(tmpDir, rel);
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(path.join(srcPath, rel), destFile);
      current++;
      if (current % 30 === 0 || current === total) {
        sseWrite(res, { type: 'progress', current, total });
      }
    }

    // ── 4. index_3d.html → index.html + 캐시 버스팅 ─────────────────────────
    sseWrite(res, { type: 'status', phase: 'patching' });
    applyIndexHtmlRename(tmpDir);
    const buildId = makeBuildId();
    applyCacheBusting(tmpDir, buildId, opts);

    // ── 5. git commit ─────────────────────────────────────────────────────────
    sseWrite(res, { type: 'status', phase: 'committing' });
    const now = new Date().toLocaleString('ko-KR');

    execSync(`git -C "${tmpDir}" add -A`);
    let commitHash = '';
    try {
      execSync(`git -C "${tmpDir}" commit -m "Deploy: ${now}"`);
      commitHash = execSync(`git -C "${tmpDir}" rev-parse --short HEAD`, { encoding: 'utf-8' }).trim();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('nothing to commit') && !msg.includes('nothing added')) throw e;
    }

    // ── 6. push → <remote>/gh-pages (force: orphan이므로 항상 덮어씀) ────────
    sseWrite(res, { type: 'status', phase: 'pushing' });
    execSync(`git -C "${tmpDir}" push "${remoteUrl}" ${tmpBranch}:${DEPLOY_BRANCH} --force`, { stdio: 'pipe' });

    const pageUrl = derivePageUrl(remoteUrl);
    sseWrite(res, { type: 'done', commitHash, pageUrl, buildId });
  } catch (err) {
    sseWrite(res, { type: 'error', message: (err as Error).message });
  } finally {
    // ── 7. worktree + 임시 브랜치 정리 ──────────────────────────────────────
    try { execSync(`git -C "${srcPath}" worktree remove "${tmpDir}" --force`, { stdio: 'pipe' }); } catch {}
    try { execSync(`git -C "${srcPath}" branch -D ${tmpBranch}`, { stdio: 'pipe' }); } catch {}
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
