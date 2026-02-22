import express, { Request, Response } from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import https from 'https';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';
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
  collectFilesForDeploy,
  collectUsedAssetNames,
  getGameTitle,
} from './deploy';

const router = express.Router();
const execAsync = promisify(exec);

// ─── 유틸 ────────────────────────────────────────────────────────────────────

async function checkButler(): Promise<boolean> {
  try { await execAsync('butler --version'); return true; } catch {}
  try { await execAsync('which butler'); return true; } catch {}
  return false;
}

/** butler login 출력으로 로그인 여부 확인 */
async function checkButlerLogin(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('butler login');
    return stdout.includes('Your local credentials are valid');
  } catch { return false; }
}

/** user/game → https://user.itch.io/game */
function deriveItchUrl(project: string): string {
  const parts = project.trim().split('/');
  if (parts.length !== 2) return '';
  const [user, game] = parts;
  return `https://${user}.itch.io/${game}`;
}

/** 게임 제목을 itch.io slug 규칙(영소문자+숫자+하이픈)으로 변환 */
function toItchSlug(title: string): string {
  return (title || 'my-game')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    || 'my-game';
}

/** itch.io에 해당 게임이 존재하는지 HEAD 요청으로 확인 */
function checkItchioGameExists(username: string, game: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: `${username}.itch.io`,
      path: `/${game}`,
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 5000,
    }, (res) => {
      resolve(res.statusCode !== 404);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// ─── 사전 조건 체크 ───────────────────────────────────────────────────────────
router.get('/deploy-itchio-check', async (_req: Request, res: Response) => {
  const butler = await checkButler();
  const loggedIn = butler ? await checkButlerLogin() : false;
  const savedUsername = settingsManager.get().itchio?.username || '';
  const gameSlug = toItchSlug(getGameTitle());
  res.json({ butler, loggedIn, username: savedUsername, gameSlug });
});

// ─── itch.io 게임 존재 여부 확인 ─────────────────────────────────────────────
router.get('/deploy-itchio-game-check', async (req: Request, res: Response) => {
  const { project } = req.query as { project?: string };
  if (!project?.trim() || !project.includes('/')) {
    res.json({ exists: null });
    return;
  }
  const [username, game] = project.trim().split('/');
  if (!username || !game) { res.json({ exists: null }); return; }
  const exists = await checkItchioGameExists(username, game);
  res.json({ exists });
});

// ─── itch.io 배포 (SSE) ───────────────────────────────────────────────────────
router.post('/deploy-itchio-progress', async (req: Request, res: Response) => {
  if (!projectManager.isOpen()) {
    res.status(404).json({ error: '프로젝트가 열려있지 않습니다' });
    return;
  }

  const { project, channel, cacheBust, bundle } = req.body as {
    project?: string;
    channel?: string;
    cacheBust?: Record<string, unknown>;
    bundle?: boolean;
  };

  if (!project?.trim()) {
    res.status(400).json({ error: 'Project (user/game)가 필요합니다' });
    return;
  }

  const resolvedChannel = channel?.trim() || 'html5';
  const srcPath = projectManager.currentPath!;
  const opts = cacheBust
    ? parseCacheBustQuery(cacheBust as Record<string, unknown>)
    : parseCacheBustQuery({});
  const buildId = makeBuildId();

  setupSSE(res);

  const sseLog = (message: string) => sseWrite(res, { type: 'log', message });
  const sseStatus = (phase: string) => sseWrite(res, { type: 'status', phase });

  let stagingDir = '';

  try {
    // ── 1. 파일 수집 및 복사 ─────────────────────────────────────────────────
    sseStatus('copying');
    sseLog('── 1/3: 파일 수집 및 복사 ──');

    let usedNames: Set<string> | undefined;
    if (opts.filterUnused) {
      sseLog('미사용 에셋 분석 중...');
      usedNames = collectUsedAssetNames(srcPath);
    }
    const files = collectFilesForDeploy(srcPath, '', usedNames);
    const total = files.length;
    sseWrite(res, { type: 'counted', total });
    sseLog(`파일 ${total}개 수집${opts.filterUnused ? ' (미사용 에셋 제외됨)' : ''}`);

    stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rpgdeploy-itchio-'));
    let current = 0;
    for (const rel of files) {
      const destFile = path.join(stagingDir, rel);
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(path.join(srcPath, rel), destFile);
      current++;
      if (current % 20 === 0 || current === total) {
        sseWrite(res, { type: 'progress', current, total });
      }
    }

    // ── 2. index.html 교체 + 캐시 버스팅 + 번들 생성 ────────────────────────
    sseStatus('patching');
    sseLog('── 2/3: index.html 교체 & 캐시 버스팅 ──');
    sseLog('index.html → index_pixi.html (PIXI 원본 백업)');
    sseLog('index_3d.html → index.html (Three.js 버전 적용)');
    applyIndexHtmlRename(stagingDir);
    sseLog(`캐시 버스팅 적용 (buildId: ${buildId})`);
    applyCacheBusting(stagingDir, buildId, opts);
    if (bundle) {
      await generateBundleFiles(stagingDir, buildId, sseLog);
    }

    // ── 3. butler push ────────────────────────────────────────────────────────
    sseStatus('uploading');
    sseLog(`── 3/3: butler push → ${project}:${resolvedChannel} ──`);
    sseLog(`$ butler push <staging> "${project}:${resolvedChannel}" --json`);

    await new Promise<void>((resolve, reject) => {
      const butler = spawn('butler', [
        'push',
        stagingDir,
        `${project.trim()}:${resolvedChannel}`,
        '--json',
      ]);

      butler.stdout.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const ev = JSON.parse(line) as Record<string, unknown>;
            if (ev.type === 'log') {
              sseLog(String(ev.message ?? ''));
            } else if (ev.type === 'progress') {
              const pct = typeof ev.progress === 'number' ? ev.progress : 0;
              sseWrite(res, { type: 'upload-progress', sent: Math.round(pct * 1000), total: 1000 });
            } else if (ev.type === 'result') {
              const val = ev.value as Record<string, unknown> | undefined;
              if (val?.state === 'error') {
                reject(new Error(String(val.message ?? 'butler 오류')));
              }
            }
          } catch {
            sseLog(line);
          }
        }
      });

      let lastError = '';
      butler.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) {
          sseLog(text);
          // 첫 줄(실제 오류 메시지)만 추출
          const firstLine = text.split('\n')[0].trim();
          if (firstLine && !firstLine.startsWith('github.com/') && !firstLine.startsWith('runtime.') && !firstLine.startsWith('\t')) {
            lastError = firstLine;
          }
        }
      });

      butler.on('close', (code) => {
        if (code === 0) resolve();
        else {
          let msg = lastError || `butler 종료 코드: ${code}`;
          if (msg.includes('invalid game')) {
            msg = `게임을 찾을 수 없습니다 (invalid game). itch.io에서 먼저 게임 페이지를 만들어 주세요: https://itch.io/game/new`;
          }
          reject(new Error(msg));
        }
      });

      butler.on('error', (err) => {
        reject(new Error(`butler 실행 실패: ${err.message}`));
      });
    });

    const itchUrl = deriveItchUrl(project.trim());
    sseLog(`\n✓ 배포 완료! (${itchUrl})`);
    sseWrite(res, { type: 'done', pageUrl: itchUrl, buildId });

  } catch (err: unknown) {
    const raw = (err as Error).message || String(err);
    sseLog(`\n✗ 오류 발생: ${raw}`);
    sseWrite(res, { type: 'error', message: raw });
  } finally {
    if (stagingDir && fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
  }

  res.end();
});

// ─── itch.io 설정 저장 ────────────────────────────────────────────────────────
router.put('/itchio-settings', (req: Request, res: Response) => {
  const { username, project, channel } = req.body as { username?: string; project?: string; channel?: string };
  const current = settingsManager.get();
  settingsManager.update({
    itchio: {
      username: username ?? current.itchio?.username ?? '',
      project: project ?? current.itchio?.project ?? '',
      channel: channel ?? current.itchio?.channel ?? 'html5',
    },
  });
  res.json({ success: true });
});

export default router;
