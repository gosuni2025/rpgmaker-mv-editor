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

  const isGitRepo = await checkGitRepo(srcPath);

  let remotes: { name: string; url: string; pageUrl: string }[] = [];
  let pageUrl = '';

  if (isGitRepo) {
    const raw = await getRemotes(srcPath);
    remotes = raw.map(r => ({ ...r, pageUrl: derivePageUrl(r.url) }));
    const sel = remotes.find(r => r.name === selectedRemote) ?? remotes[0];
    pageUrl = sel?.pageUrl ?? '';
  }

  res.json({ isGitRepo, remotes, selectedRemote, pageUrl });
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

  // 배포 전 현재 브랜치를 기억해두고 복귀에 사용
  let originalBranch = 'main';
  let stashed = false;

  try {
    // ── 1. remote URL 확인 ────────────────────────────────────────────────────
    const remoteUrl = await getRemoteUrl(srcPath, remote);
    if (!remoteUrl) {
      sseWrite(res, { type: 'error', message: `remote '${remote}'를 찾을 수 없습니다. git remote add ${remote} <URL> 을 실행해주세요.` });
      res.end();
      return;
    }

    // ── 2. 리모트 gh-pages 브랜치가 로컬보다 앞서있는지 확인 ─────────────────
    // 비교 기준: 로컬 gh-pages 브랜치 (HEAD가 아님 — 이전 배포 커밋이 항상 걸리므로)
    // 로컬 gh-pages가 없으면 첫 배포이므로 체크 스킵
    sseWrite(res, { type: 'status', phase: 'copying' });
    try {
      const localGhExists = (() => {
        try {
          execSync(`git -C "${srcPath}" rev-parse --verify ${DEPLOY_BRANCH}`, { stdio: 'pipe' });
          return true;
        } catch { return false; }
      })();
      if (localGhExists) {
        execSync(`git -C "${srcPath}" fetch ${remote} ${DEPLOY_BRANCH}`, { stdio: 'pipe' });
        const behind = execSync(
          `git -C "${srcPath}" rev-list ${DEPLOY_BRANCH}..${remote}/${DEPLOY_BRANCH} --count`,
          { encoding: 'utf-8' }
        ).trim();
        if (parseInt(behind, 10) > 0) {
          sseWrite(res, {
            type: 'error',
            message: `원격 ${remote}/${DEPLOY_BRANCH} 브랜치가 ${behind}개 커밋 앞서 있습니다.\ngit pull ${remote} ${DEPLOY_BRANCH} 를 실행한 뒤 다시 배포하세요.`,
          });
          res.end();
          return;
        }
      }
    } catch {
      // fetch 실패(리모트에 브랜치 없음 등)는 무시하고 계속 진행
    }

    // ── 3. 현재 브랜치 저장 & 미커밋 변경사항 stash ──────────────────────────
    originalBranch = execSync(`git -C "${srcPath}" rev-parse --abbrev-ref HEAD`, { encoding: 'utf-8' }).trim();

    const dirty = execSync(`git -C "${srcPath}" status --porcelain`, { encoding: 'utf-8' }).trim();
    if (dirty) {
      execSync(`git -C "${srcPath}" stash push -m "rpgmv-deploy-stash"`, { stdio: 'pipe' });
      stashed = true;
    }

    // ── 4. gh-pages 브랜치로 전환 (현재 HEAD 기준으로 생성/리셋) ─────────────
    execSync(`git -C "${srcPath}" checkout -B ${DEPLOY_BRANCH}`, { stdio: 'pipe' });

    // ── 5. index_3d.html → index.html + 캐시 버스팅 ─────────────────────────
    // 이 시점의 working tree = 소스 파일 그대로 (브랜치 전환해도 파일은 동일)
    sseWrite(res, { type: 'status', phase: 'patching' });
    applyIndexHtmlRename(srcPath);
    const buildId = makeBuildId();
    applyCacheBusting(srcPath, buildId, opts);

    // ── 6. git commit ─────────────────────────────────────────────────────────
    sseWrite(res, { type: 'status', phase: 'committing' });
    const now = new Date().toLocaleString('ko-KR');

    execSync(`git -C "${srcPath}" add -A`);
    let commitHash = '';
    try {
      execSync(`git -C "${srcPath}" commit -m "Deploy: ${now}"`);
      commitHash = execSync(`git -C "${srcPath}" rev-parse --short HEAD`, { encoding: 'utf-8' }).trim();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('nothing to commit') && !msg.includes('nothing added')) throw e;
    }

    // ── 7. push → remote/gh-pages ────────────────────────────────────────────
    sseWrite(res, { type: 'status', phase: 'pushing' });
    execSync(`git -C "${srcPath}" push ${remote} ${DEPLOY_BRANCH} --force`, { stdio: 'pipe' });

    const pageUrl = derivePageUrl(remoteUrl);
    sseWrite(res, { type: 'done', commitHash, pageUrl, buildId });
  } catch (err) {
    sseWrite(res, { type: 'error', message: (err as Error).message });
  } finally {
    // ── 8. 원래 브랜치로 복귀 & stash 복원 ──────────────────────────────────
    try { execSync(`git -C "${srcPath}" checkout ${originalBranch}`, { stdio: 'pipe' }); } catch {}
    if (stashed) try { execSync(`git -C "${srcPath}" stash pop`, { stdio: 'pipe' }); } catch {}
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
