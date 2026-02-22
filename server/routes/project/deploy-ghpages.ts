import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import projectManager from '../../services/projectManager';
import settingsManager from '../../services/settingsManager';
import {
  applyIndexHtmlRename,
  applyCacheBusting,
  makeBuildId,
  generateBundleFiles,
  setupSSE,
  sseWrite,
  parseCacheBustQuery,
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

// ─── 로그 전송 헬퍼 ─────────────────────────────────────────────────────────
function sseLog(res: Response, message: string) {
  sseWrite(res, { type: 'log', message });
}

function sseLogCmd(res: Response, cmd: string) {
  // git -C "/path/to/project" ... → git ... 으로 축약하여 표시
  const displayCmd = cmd.replace(/ -C "[^"]*"/, '');
  sseWrite(res, { type: 'log', message: `$ ${displayCmd}` });
}

// git 명령 실행 + 로그 전송
function gitExecLog(res: Response, cmd: string, opts: { encoding?: BufferEncoding } = {}): string {
  sseLogCmd(res, cmd);
  const result = gitExec(cmd, opts);
  const trimmed = result.trim();
  if (trimmed) sseLog(res, trimmed);
  return result;
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
  const bundle = req.query.bundle === '1';

  setupSSE(res);

  // 배포 전 현재 브랜치를 기억해두고 복귀에 사용
  let originalBranch = 'main';
  let stashed = false;
  let currentStep = '';

  try {
    // ── 1. remote URL 확인 ────────────────────────────────────────────────────
    currentStep = `remote '${remote}' URL 확인`;
    sseWrite(res, { type: 'status', phase: 'copying' });
    sseLog(res, `── 1/7: remote '${remote}' URL 확인 ──`);

    sseLogCmd(res, `git -C "${srcPath}" remote get-url ${remote}`);
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
    sseLog(res, `→ ${remoteUrl}`);

    // ── 2. 리모트 gh-pages 브랜치가 로컬보다 앞서있는지 확인 ─────────────────
    currentStep = `리모트 ${remote}/${DEPLOY_BRANCH} 동기화 확인`;
    sseLog(res, `── 2/7: 리모트 동기화 확인 ──`);
    try {
      const localGhExists = (() => {
        try {
          gitExec(`git -C "${srcPath}" rev-parse --verify ${DEPLOY_BRANCH}`);
          return true;
        } catch { return false; }
      })();
      if (localGhExists) {
        sseLog(res, `로컬 ${DEPLOY_BRANCH} 브랜치 존재 → fetch 시작`);
        gitExecLog(res, `git -C "${srcPath}" fetch ${remote} ${DEPLOY_BRANCH}`);
        sseLogCmd(res, `git -C "${srcPath}" rev-list ${DEPLOY_BRANCH}..${remote}/${DEPLOY_BRANCH} --count`);
        const behind = gitExec(
          `git -C "${srcPath}" rev-list ${DEPLOY_BRANCH}..${remote}/${DEPLOY_BRANCH} --count`,
        ).trim();
        sseLog(res, `뒤처진 커밋 수: ${behind}`);
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
      } else {
        sseLog(res, `로컬 ${DEPLOY_BRANCH} 브랜치 없음 (첫 배포) → 동기화 검사 건너뜀`);
      }
    } catch (fetchErr: unknown) {
      const msg = (fetchErr as Error).message || '';
      if (!msg.includes("couldn't find remote ref") && !msg.includes('unknown revision')) {
        sseLog(res, `fetch 경고 (무시됨): ${msg}`);
        console.warn(`[deploy-ghpages] fetch 경고 (무시됨): ${msg}`);
      } else {
        sseLog(res, `리모트에 ${DEPLOY_BRANCH} 브랜치 없음 (첫 배포) → 계속 진행`);
      }
    }

    // ── 3. 현재 브랜치 저장 & 미커밋 변경사항 stash ──────────────────────────
    currentStep = '현재 브랜치/상태 저장';
    sseLog(res, `── 3/7: 현재 상태 저장 ──`);
    originalBranch = gitExecLog(res, `git -C "${srcPath}" rev-parse --abbrev-ref HEAD`).trim();

    sseLogCmd(res, `git -C "${srcPath}" status --porcelain`);
    const dirty = gitExec(`git -C "${srcPath}" status --porcelain`).trim();
    if (dirty) {
      const changedCount = dirty.split('\n').length;
      sseLog(res, `미커밋 변경 ${changedCount}개 발견 → stash`);
      gitExecLog(res, `git -C "${srcPath}" stash push -m "rpgmv-deploy-stash"`);
      stashed = true;
    } else {
      sseLog(res, `미커밋 변경 없음`);
    }

    // ── 4. gh-pages 브랜치로 전환 (현재 HEAD 기준으로 생성/리셋) ─────────────
    currentStep = `${DEPLOY_BRANCH} 브랜치 전환 (checkout -B)`;
    sseLog(res, `── 4/7: ${DEPLOY_BRANCH} 브랜치 전환 ──`);
    gitExecLog(res, `git -C "${srcPath}" checkout -B ${DEPLOY_BRANCH}`);

    // ── 5. index_3d.html → index.html + 캐시 버스팅 ─────────────────────────
    currentStep = 'index.html 교체 및 캐시 버스팅 적용';
    sseWrite(res, { type: 'status', phase: 'patching' });
    sseLog(res, `── 5/7: index.html 교체 & 캐시 버스팅 ──`);
    sseLog(res, `index.html → index_pixi.html (PIXI 원본 백업)`);
    sseLog(res, `index_3d.html → index.html (Three.js 버전 적용)`);
    applyIndexHtmlRename(srcPath);
    const buildId = makeBuildId();
    sseLog(res, `캐시 버스팅 적용 (buildId: ${buildId})`);
    const cbFlags = [
      opts.scripts !== false ? 'scripts' : null,
      opts.images !== false ? 'images' : null,
      opts.audio !== false ? 'audio' : null,
      opts.video !== false ? 'video' : null,
      opts.data !== false ? 'data' : null,
    ].filter(Boolean).join(', ');
    if (cbFlags) sseLog(res, `  대상: ${cbFlags}`);
    // GhPages는 파일 변환 없이 직접 커밋하므로 WebP 플래그 비활성화
    applyCacheBusting(srcPath, buildId, { ...opts, convertWebp: false });
    if (bundle) {
      await generateBundleFiles(srcPath, buildId, (msg) => sseLog(res, msg));
      // ZIP으로 묶인 폴더는 git에서 제거 (bundles/*.zip으로 대체됨)
      sseLog(res, 'img/, audio/, data/ 원본 제거 (bundles/*.zip으로 대체)');
      for (const dir of ['img', 'audio', 'data']) {
        const dirPath = path.join(srcPath, dir);
        if (fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true });
      }
    }

    // ── 6. git commit ─────────────────────────────────────────────────────────
    currentStep = 'git commit';
    sseWrite(res, { type: 'status', phase: 'committing' });
    sseLog(res, `── 6/7: git commit ──`);
    const now = new Date().toLocaleString('ko-KR');

    gitExecLog(res, `git -C "${srcPath}" add -A`);
    let commitHash = '';
    try {
      gitExecLog(res, `git -C "${srcPath}" commit -m "Deploy: ${now}"`);
      commitHash = gitExec(`git -C "${srcPath}" rev-parse --short HEAD`).trim();
      sseLog(res, `커밋 완료: ${commitHash}`);
    } catch (e: unknown) {
      const msg = (e as Error).message;
      if (!msg.includes('nothing to commit') && !msg.includes('nothing added')) throw e;
      sseLog(res, `변경사항 없음 (이전 배포와 동일)`);
    }

    // ── 7. push → remote/gh-pages ────────────────────────────────────────────
    currentStep = `git push ${remote} ${DEPLOY_BRANCH} --force`;
    sseWrite(res, { type: 'status', phase: 'pushing' });
    sseLog(res, `── 7/7: git push ──`);
    gitExecLog(res, `git -C "${srcPath}" push ${remote} ${DEPLOY_BRANCH} --force`);

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
      sseLog(res, `── GitHub Pages 소스 브랜치 설정 ──`);
      try {
        // 이미 활성화된 경우 PUT, 처음이면 POST
        try {
          sseLogCmd(res, `gh api repos/${ownerRepo}/pages -X PUT -f 'source[branch]=${DEPLOY_BRANCH}' -f 'source[path]=/'`);
          gitExec(`gh api repos/${ownerRepo}/pages -X PUT -f 'source[branch]=${DEPLOY_BRANCH}' -f 'source[path]=/'`);
          sseLog(res, `GitHub Pages 소스 설정 완료`);
        } catch {
          sseLogCmd(res, `gh api repos/${ownerRepo}/pages -X POST -f 'source[branch]=${DEPLOY_BRANCH}' -f 'source[path]=/'`);
          gitExec(`gh api repos/${ownerRepo}/pages -X POST -f 'source[branch]=${DEPLOY_BRANCH}' -f 'source[path]=/'`);
          sseLog(res, `GitHub Pages 소스 설정 완료 (신규 생성)`);
        }
      } catch (ghErr: unknown) {
        // gh CLI 없음 또는 권한 없음 — 배포 자체는 성공이므로 경고만
        const ghMsg = (ghErr as Error).message || '';
        sseLog(res, `GitHub Pages 자동 설정 실패 (무시됨): ${ghMsg}`);
        sseWrite(res, {
          type: 'status',
          phase: 'pages-setup-skipped',
          detail: `GitHub Pages 소스 자동 설정 실패 (무시됨):\n${ghMsg}\n저장소 Settings → Pages에서 수동으로 Source를 '${DEPLOY_BRANCH}' 브랜치로 설정하세요.`,
        } as never);
      }
    }

    sseLog(res, `\n✓ 배포 완료! (${pageUrl})`);
    sseWrite(res, { type: 'done', commitHash, pageUrl, buildId });
  } catch (err: unknown) {
    const raw = (err as Error).message || String(err);
    sseLog(res, `\n✗ 오류 발생: ${raw}`);
    sseWrite(res, {
      type: 'error',
      message: `[${currentStep}] 오류:\n${raw}`,
    });
  } finally {
    // ── 원래 브랜치로 복귀 & stash 복원 ──────────────────────────────────
    sseLog(res, `\n── 정리: 원래 브랜치로 복귀 ──`);
    try {
      sseLogCmd(res, `git -C "${srcPath}" checkout ${originalBranch}`);
      gitExec(`git -C "${srcPath}" checkout ${originalBranch}`);
      sseLog(res, `→ ${originalBranch} 브랜치로 복귀 완료`);
    } catch {}
    if (stashed) {
      try {
        sseLogCmd(res, `git -C "${srcPath}" stash pop`);
        gitExec(`git -C "${srcPath}" stash pop`);
        sseLog(res, `→ stash 복원 완료`);
      } catch {}
    }
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
