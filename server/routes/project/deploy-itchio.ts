import express, { Request, Response } from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';
import projectManager from '../../services/projectManager';
import settingsManager from '../../services/settingsManager';
import {
  applyIndexHtmlRename,
  applyCacheBusting,
  makeBuildId,
  setupSSE,
  sseWrite,
  parseCacheBustQuery,
  collectFilesForDeploy,
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

/** butler whoami --json → 기존 로그인 세션으로 username 반환, 미로그인 시 null */
async function getButlerUsername(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('butler whoami --json');
    const lines = stdout.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const ev = JSON.parse(line) as Record<string, unknown>;
        // {"type":"result","value":{"username":"...","displayName":"..."}}
        if (ev.type === 'result' && ev.value) {
          const val = ev.value as Record<string, unknown>;
          if (typeof val.username === 'string') return val.username;
        }
      } catch {}
    }
  } catch {}
  return null;
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

// ─── 사전 조건 체크 ───────────────────────────────────────────────────────────
router.get('/deploy-itchio-check', async (_req: Request, res: Response) => {
  const butler = await checkButler();
  const username = butler ? await getButlerUsername() : null;
  const gameSlug = toItchSlug(getGameTitle());
  res.json({ butler, username, gameSlug });
});

// ─── itch.io 배포 (SSE) ───────────────────────────────────────────────────────
router.post('/deploy-itchio-progress', async (req: Request, res: Response) => {
  if (!projectManager.isOpen()) {
    res.status(404).json({ error: '프로젝트가 열려있지 않습니다' });
    return;
  }

  const { apiKey, project, channel, cacheBust } = req.body as {
    apiKey?: string;
    project?: string;
    channel?: string;
    cacheBust?: Record<string, unknown>;
  };

  if (!apiKey?.trim()) {
    res.status(400).json({ error: 'API Key가 필요합니다' });
    return;
  }
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

    const files = collectFilesForDeploy(srcPath);
    const total = files.length;
    sseWrite(res, { type: 'counted', total });
    sseLog(`파일 ${total}개 수집`);

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

    // ── 2. index.html 교체 + 캐시 버스팅 ─────────────────────────────────────
    sseStatus('patching');
    sseLog('── 2/3: index.html 교체 & 캐시 버스팅 ──');
    sseLog('index.html → index_pixi.html (PIXI 원본 백업)');
    sseLog('index_3d.html → index.html (Three.js 버전 적용)');
    applyIndexHtmlRename(stagingDir);
    sseLog(`캐시 버스팅 적용 (buildId: ${buildId})`);
    applyCacheBusting(stagingDir, buildId, opts);

    // ── 3. butler push ────────────────────────────────────────────────────────
    sseStatus('uploading');
    sseLog(`── 3/3: butler push → ${project}:${resolvedChannel} ──`);
    sseLog(`$ butler push <staging> "${project}:${resolvedChannel}" --json --api-key ***`);

    await new Promise<void>((resolve, reject) => {
      const butler = spawn('butler', [
        'push',
        stagingDir,
        `${project.trim()}:${resolvedChannel}`,
        '--json',
        '--api-key', apiKey.trim(),
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

      butler.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) sseLog(text);
      });

      butler.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`butler 종료 코드: ${code}`));
      });

      butler.on('error', (err) => {
        reject(new Error(`butler 실행 실패: ${err.message}\nbutler가 설치되어 있는지 확인하세요.`));
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
  const { apiKey, project, channel } = req.body as {
    apiKey?: string;
    project?: string;
    channel?: string;
  };
  const current = settingsManager.get();
  settingsManager.update({
    itchio: {
      apiKey: apiKey ?? current.itchio?.apiKey ?? '',
      project: project ?? current.itchio?.project ?? '',
      channel: channel ?? current.itchio?.channel ?? 'html5',
    },
  });
  res.json({ success: true });
});

export default router;
