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
  try { await execAsync('gh --version'); return true; } catch {}
  try { await execAsync('which gh'); return true; } catch {}
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

// ─── git execSync 래퍼: stderr까지 포함한 에러 메시지 생성 ───────────────────
function gitExec(cmd: string, opts: { encoding?: BufferEncoding } = {}): string {
  try {
    return execSync(cmd, { encoding: opts.encoding ?? 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }) as string;
  } catch (e: unknown) {
    const err = e as { message?: string; stderr?: Buffer | string; stdout?: Buffer | string; status?: number };
    const stderr = (err.stderr ? err.stderr.toString() : '').trim();
    const stdout = (err.stdout ? err.stdout.toString() : '').trim();
    const code = err.status !== undefined ? ` (exit ${err.status})` : '';
    // stderr 우선, 없으면 stdout, 없으면 message
    const detail = stderr || stdout || err.message || String(e);
    throw new Error(`${detail}${code}`);
  }
}

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
  let currentStep = '';

  try {
    // ── 1. remote URL 확인 ────────────────────────────────────────────────────
    currentStep = `remote '${remote}' URL 확인`;
    const remoteUrl = await getRemoteUrl(srcPath, remote);
    if (!remoteUrl) {
      sseWrite(res, {
        type: 'error',
        message: `[${currentStep}] remote '${remote}'를 찾을 수 없습니다.\n` +
          `프로젝트 폴더(${srcPath})에서 다음 명령으로 추가하세요:\n` +
          `  git remote add ${remote} https://github.com/<owner>/<repo>.git`,
      });
      res.end();
      return;
    }

    // ── 2. 리모트 gh-pages 브랜치가 로컬보다 앞서있는지 확인 ─────────────────
    // 비교 기준: 로컬 gh-pages 브랜치 (HEAD가 아님 — 이전 배포 커밋이 항상 걸리므로)
    // 로컬 gh-pages가 없으면 첫 배포이므로 체크 스킵
    sseWrite(res, { type: 'status', phase: 'copying' });
    currentStep = `리모트 ${remote}/${DEPLOY_BRANCH} 동기화 확인`;
    try {
      const localGhExists = (() => {
        try {
          gitExec(`git -C "${srcPath}" rev-parse --verify ${DEPLOY_BRANCH}`);
          return true;
        } catch { return false; }
      })();
      if (localGhExists) {
        gitExec(`git -C "${srcPath}" fetch ${remote} ${DEPLOY_BRANCH}`);
        const behind = gitExec(
          `git -C "${srcPath}" rev-list ${DEPLOY_BRANCH}..${remote}/${DEPLOY_BRANCH} --count`,
        ).trim();
        if (parseInt(behind, 10) > 0) {
          const remoteLog = (() => {
            try {
              return gitExec(
                `git -C "${srcPath}" log ${DEPLOY_BRANCH}..${remote}/${DEPLOY_BRANCH} --oneline`,
              ).trim();
            } catch { return ''; }
          })();
          sseWrite(res, {
            type: 'error',
            message: `[${currentStep}] 원격 ${remote}/${DEPLOY_BRANCH}가 로컬보다 ${behind}개 커밋 앞서 있습니다.\n` +
              (remoteLog ? `앞선 커밋:\n${remoteLog}\n\n` : '') +
              `다른 기기 또는 다른 경로에서 배포된 것 같습니다.\n` +
              `로컬 프로젝트 폴더에서 다음 명령으로 동기화하세요:\n` +
              `  git fetch ${remote} ${DEPLOY_BRANCH}\n` +
              `  git branch -f ${DEPLOY_BRANCH} ${remote}/${DEPLOY_BRANCH}`,
          });
          res.end();
          return;
        }
      }
    } catch (fetchErr: unknown) {
      // 리모트에 gh-pages 브랜치 없음(첫 배포) 등은 무시하고 계속 진행
      const msg = (fetchErr as Error).message || '';
      if (!msg.includes("couldn't find remote ref") && !msg.includes('unknown revision')) {
        // 예상치 못한 fetch 오류는 경고만 남기고 계속 진행
        console.warn(`[deploy-ghpages] fetch 경고 (무시됨): ${msg}`);
      }
    }

    // ── 3. 현재 브랜치 저장 & 미커밋 변경사항 stash ──────────────────────────
    currentStep = '현재 브랜치/상태 저장';
    originalBranch = gitExec(`git -C "${srcPath}" rev-parse --abbrev-ref HEAD`).trim();

    const dirty = gitExec(`git -C "${srcPath}" status --porcelain`).trim();
    if (dirty) {
      gitExec(`git -C "${srcPath}" stash push -m "rpgmv-deploy-stash"`);
      stashed = true;
    }

    // ── 4. gh-pages 브랜치로 전환 (현재 HEAD 기준으로 생성/리셋) ─────────────
    currentStep = `${DEPLOY_BRANCH} 브랜치 전환 (checkout -B)`;
    gitExec(`git -C "${srcPath}" checkout -B ${DEPLOY_BRANCH}`);

    // ── 5. index_3d.html → index.html + 캐시 버스팅 ─────────────────────────
    // 이 시점의 working tree = 소스 파일 그대로 (브랜치 전환해도 파일은 동일)
    currentStep = 'index.html 교체 및 캐시 버스팅 적용';
    sseWrite(res, { type: 'status', phase: 'patching' });
    applyIndexHtmlRename(srcPath);
    const buildId = makeBuildId();
    applyCacheBusting(srcPath, buildId, opts);

    // ── 6. git commit ─────────────────────────────────────────────────────────
    currentStep = 'git commit';
    sseWrite(res, { type: 'status', phase: 'committing' });
    const now = new Date().toLocaleString('ko-KR');

    gitExec(`git -C "${srcPath}" add -A`);
    let commitHash = '';
    try {
      gitExec(`git -C "${srcPath}" commit -m "Deploy: ${now}"`);
      commitHash = gitExec(`git -C "${srcPath}" rev-parse --short HEAD`).trim();
    } catch (e: unknown) {
      const msg = (e as Error).message;
      if (!msg.includes('nothing to commit') && !msg.includes('nothing added')) throw e;
    }

    // ── 7. push → remote/gh-pages ────────────────────────────────────────────
    currentStep = `git push ${remote} ${DEPLOY_BRANCH} --force`;
    sseWrite(res, { type: 'status', phase: 'pushing' });
    gitExec(`git -C "${srcPath}" push ${remote} ${DEPLOY_BRANCH} --force`);

    // ── 8. GitHub Pages 소스 브랜치 설정 (gh api, 없으면 스킵) ─────────────────
    const pageUrl = derivePageUrl(remoteUrl);
    const ownerRepo = (() => {
      const m = remoteUrl.trim()
        .replace(/^git@github\.com:/, 'https://github.com/')
        .replace(/\.git$/, '')
        .match(/github\.com\/([^/]+\/.+)/);
      return m ? m[1] : null;
    })();

    if (ownerRepo) {
      currentStep = `GitHub Pages 소스 설정 (gh api)`;
      sseWrite(res, { type: 'status', phase: 'pages-setup' });
      try {
        // 이미 활성화된 경우 PUT, 처음이면 POST
        try {
          gitExec(`gh api repos/${ownerRepo}/pages -X PUT -f 'source[branch]=${DEPLOY_BRANCH}' -f 'source[path]=/'`);
        } catch {
          gitExec(`gh api repos/${ownerRepo}/pages -X POST -f 'source[branch]=${DEPLOY_BRANCH}' -f 'source[path]=/'`);
        }
      } catch (ghErr: unknown) {
        // gh CLI 없음 또는 권한 없음 — 배포 자체는 성공이므로 경고만
        const ghMsg = (ghErr as Error).message || '';
        sseWrite(res, {
          type: 'status',
          phase: 'pages-setup-skipped',
          detail: `GitHub Pages 소스 자동 설정 실패 (무시됨):\n${ghMsg}\n저장소 Settings → Pages에서 수동으로 Source를 '${DEPLOY_BRANCH}' 브랜치로 설정하세요.`,
        } as never);
      }
    }

    sseWrite(res, { type: 'done', commitHash, pageUrl, buildId });
  } catch (err: unknown) {
    const raw = (err as Error).message || String(err);
    sseWrite(res, {
      type: 'error',
      message: `[${currentStep}] 오류:\n${raw}`,
    });
  } finally {
    // ── 8. 원래 브랜치로 복귀 & stash 복원 ──────────────────────────────────
    try { gitExec(`git -C "${srcPath}" checkout ${originalBranch}`); } catch {}
    if (stashed) try { gitExec(`git -C "${srcPath}" stash pop`); } catch {}
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
