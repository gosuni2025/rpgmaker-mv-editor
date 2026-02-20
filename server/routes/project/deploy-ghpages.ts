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

/** 배포 대상 브랜치 — GitHub Pages는 gh-pages 브랜치를 서비스함 */
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

/** git remote URL에서 GitHub Pages URL 추출 */
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

/** 원격에 gh-pages 브랜치가 이미 존재하는지 확인 */
async function remoteBranchExists(remoteUrl: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`git ls-remote --heads "${remoteUrl}" "${DEPLOY_BRANCH}"`);
    return stdout.trim().length > 0;
  } catch { return false; }
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

  // 배포마다 새 임시 디렉터리 사용 — 완료 후 삭제
  const tmpDir = path.join(os.tmpdir(), `rpgmv-deploy-${crypto.randomBytes(6).toString('hex')}`);

  try {
    // ── 1. remote URL 확인 ────────────────────────────────────────────────────
    const remoteUrl = await getRemoteUrl(srcPath, remote);
    if (!remoteUrl) {
      sseWrite(res, { type: 'error', message: `remote '${remote}'를 찾을 수 없습니다. git remote add ${remote} <URL> 을 실행해주세요.` });
      res.end();
      return;
    }

    // ── 2. gh-pages 브랜치 clone 또는 orphan 생성 ────────────────────────────
    sseWrite(res, { type: 'status', phase: 'copying' });

    const branchExists = await remoteBranchExists(remoteUrl);
    if (branchExists) {
      // 기존 gh-pages 브랜치 shallow clone (빠름)
      execSync(`git clone --depth=1 --branch ${DEPLOY_BRANCH} "${remoteUrl}" "${tmpDir}"`, { stdio: 'pipe' });
    } else {
      // 첫 배포: main 브랜치 clone 후 orphan gh-pages 브랜치 생성
      execSync(`git clone --depth=1 "${remoteUrl}" "${tmpDir}"`, { stdio: 'pipe' });
      execSync(`git -C "${tmpDir}" checkout --orphan ${DEPLOY_BRANCH}`, { stdio: 'pipe' });
      try { execSync(`git -C "${tmpDir}" rm -rf .`, { stdio: 'pipe' }); } catch {}
    }

    // git author 설정 (CI/서버 환경에서 미설정일 수 있음)
    execSync(`git -C "${tmpDir}" config user.email "deploy@rpgmaker-editor"`, { stdio: 'pipe' });
    execSync(`git -C "${tmpDir}" config user.name "RPG Maker MV Editor"`, { stdio: 'pipe' });

    // ── 3. 기존 파일 정리 (.git 제외) ─────────────────────────────────────────
    for (const entry of fs.readdirSync(tmpDir)) {
      if (entry === '.git') continue;
      fs.rmSync(path.join(tmpDir, entry), { recursive: true, force: true });
    }

    // ── 4. 프로젝트 파일 복사 ─────────────────────────────────────────────────
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

    // ── 5. index_3d.html → index.html + 캐시 버스팅 ─────────────────────────
    // 소스의 index.html(PIXI용)은 index_pixi.html로 보존,
    // Three.js 런타임인 index_3d.html을 index.html로 사용
    sseWrite(res, { type: 'status', phase: 'patching' });
    applyIndexHtmlRename(tmpDir);
    const buildId = makeBuildId();
    applyCacheBusting(tmpDir, buildId, opts);

    // ── 6. git commit ─────────────────────────────────────────────────────────
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

    // ── 7. git push → origin gh-pages ────────────────────────────────────────
    sseWrite(res, { type: 'status', phase: 'pushing' });
    execSync(`git -C "${tmpDir}" push origin ${DEPLOY_BRANCH}`, { stdio: 'pipe' });

    const pageUrl = derivePageUrl(remoteUrl);
    sseWrite(res, { type: 'done', commitHash, pageUrl, buildId });
  } catch (err) {
    sseWrite(res, { type: 'error', message: (err as Error).message });
  } finally {
    // ── 8. 임시 디렉터리 삭제 ─────────────────────────────────────────────────
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
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
