import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
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
  EXCLUDE_DIRS,
  CacheBustOptions,
} from './deploy';

const router = express.Router();
const execAsync = promisify(exec);

// ─── 유틸 ────────────────────────────────────────────────────────────────────

/** gh CLI 설치 여부 확인 */
async function checkGhCli(): Promise<boolean> {
  try {
    await execAsync('which gh');
    return true;
  } catch {
    try {
      await execAsync('gh --version');
      return true;
    } catch {
      return false;
    }
  }
}

/** 경로가 유효한 git 저장소인지 확인 */
async function checkGitRepo(repoPath: string): Promise<boolean> {
  if (!repoPath || !fs.existsSync(repoPath)) return false;
  try {
    await execAsync(`git -C "${repoPath}" rev-parse --git-dir`);
    return true;
  } catch {
    return false;
  }
}

/** git remote URL에서 GitHub Pages URL 추출 */
function derivePageUrl(remoteUrl: string): string {
  // https://github.com/user/repo.git → https://user.github.io/repo
  // git@github.com:user/repo.git   → https://user.github.io/repo
  const m = remoteUrl.trim()
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '')
    .match(/github\.com\/([^/]+)\/(.+)/);
  if (!m) return '';
  return `https://${m[1]}.github.io/${m[2]}`;
}

/** 원격 저장소 URL 가져오기 */
async function getRemoteUrl(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`git -C "${repoPath}" remote get-url origin`);
    return stdout.trim();
  } catch {
    return '';
  }
}

// ─── 사전 조건 체크 ───────────────────────────────────────────────────────────
router.get('/deploy-ghpages-check', async (_req: Request, res: Response) => {
  const settings = settingsManager.get();
  const repoPath = settings.ghPages?.repoPath || '';

  const [ghCli, isGitRepo] = await Promise.all([
    checkGhCli(),
    checkGitRepo(repoPath),
  ]);

  let pageUrl = '';
  if (isGitRepo) {
    const remoteUrl = await getRemoteUrl(repoPath);
    pageUrl = derivePageUrl(remoteUrl);
  }

  res.json({ ghCli, repoPath, isGitRepo, pageUrl });
});

// ─── GitHub Pages 배포 (SSE) ──────────────────────────────────────────────────
router.get('/deploy-ghpages-progress', async (req: Request, res: Response) => {
  if (!projectManager.isOpen()) {
    res.status(404).json({ error: '프로젝트가 열려있지 않습니다' });
    return;
  }

  // repoPath: query 우선, 없으면 설정값
  const settings = settingsManager.get();
  const repoPath = (req.query.repoPath as string | undefined)?.trim()
    || settings.ghPages?.repoPath || '';

  if (!repoPath) {
    res.status(400).json({ error: '저장소 경로가 설정되지 않았습니다' });
    return;
  }

  const opts = parseCacheBustQuery(req.query as Record<string, unknown>);

  setupSSE(res);

  try {
    // ── 1. 파일 수집 ──────────────────────────────────────────────────────────
    sseWrite(res, { type: 'status', phase: 'copying' });
    const srcPath = projectManager.currentPath!;
    const files = collectFilesForDeploy(srcPath);
    const total = files.length;
    sseWrite(res, { type: 'counted', total });

    // ── 2. 기존 파일 정리 (.git 제외) ─────────────────────────────────────────
    if (fs.existsSync(repoPath)) {
      for (const entry of fs.readdirSync(repoPath)) {
        if (entry === '.git') continue;
        fs.rmSync(path.join(repoPath, entry), { recursive: true, force: true });
      }
    } else {
      fs.mkdirSync(repoPath, { recursive: true });
    }

    // ── 3. 파일 복사 ──────────────────────────────────────────────────────────
    let current = 0;
    for (const rel of files) {
      const destFile = path.join(repoPath, rel);
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(path.join(srcPath, rel), destFile);
      current++;
      if (current % 30 === 0 || current === total) {
        sseWrite(res, { type: 'progress', current, total });
      }
    }

    // ── 4. index_3d.html → index.html rename + 캐시 버스팅 ───────────────────
    sseWrite(res, { type: 'status', phase: 'patching' });
    applyIndexHtmlRename(repoPath);
    const buildId = makeBuildId();
    applyCacheBusting(repoPath, buildId, opts);

    // ── 5. git commit & push ──────────────────────────────────────────────────
    sseWrite(res, { type: 'status', phase: 'committing' });
    const now = new Date().toLocaleString('ko-KR');
    const commitMsg = `Deploy: ${now}`;

    execSync(`git -C "${repoPath}" add -A`);
    let commitHash = '';
    try {
      execSync(`git -C "${repoPath}" commit -m "${commitMsg}"`);
      const hashResult = execSync(`git -C "${repoPath}" rev-parse --short HEAD`, { encoding: 'utf-8' });
      commitHash = hashResult.trim();
    } catch (e: unknown) {
      // nothing to commit은 에러 아님
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('nothing to commit') && !msg.includes('nothing added')) throw e;
    }

    sseWrite(res, { type: 'status', phase: 'pushing' });
    execSync(`git -C "${repoPath}" push`, { stdio: 'pipe' });

    const remoteUrl = await getRemoteUrl(repoPath);
    const pageUrl = derivePageUrl(remoteUrl);

    sseWrite(res, { type: 'done', commitHash, pageUrl, buildId });
  } catch (err) {
    sseWrite(res, { type: 'error', message: (err as Error).message });
  }
  res.end();
});

// ─── GitHub Pages 설정 저장 ───────────────────────────────────────────────────
router.put('/ghpages-settings', (req: Request, res: Response) => {
  const { repoPath } = req.body as { repoPath?: string };
  const current = settingsManager.get();
  settingsManager.update({ ghPages: { ...current.ghPages, repoPath: repoPath || '' } });
  res.json({ success: true });
});

export default router;
