import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const router = Router();

// 에디터 루트 디렉터리 (server/routes/version.ts → 두 단계 위)
const editorRoot = path.join(__dirname, '..', '..');

/** 현재 설치 타입과 버전 정보 반환 */
router.get('/info', (req, res) => {
  const hasGit = fs.existsSync(path.join(editorRoot, '.git'));

  if (hasGit) {
    // git clone 설치: 최신 커밋 날짜와 해시 반환
    try {
      const out = execSync('git log -1 --format=%cI|||%H', {
        cwd: editorRoot,
        timeout: 5000,
      })
        .toString()
        .trim();
      const [commitDate, commitHash] = out.split('|||');
      res.json({ type: 'git', commitDate, commitHash: commitHash?.slice(0, 7) });
    } catch {
      res.json({ type: 'git', commitDate: null, commitHash: null });
    }
  } else {
    // 릴리즈 설치: electron main이 주입한 APP_VERSION 우선, fallback으로 package.json
    const envVersion = process.env.APP_VERSION;
    if (envVersion) {
      res.json({ type: 'release', version: envVersion });
      return;
    }
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(editorRoot, 'package.json'), 'utf8'));
      res.json({ type: 'release', version: pkg.version ?? '0.0.0' });
    } catch {
      res.json({ type: 'release', version: '0.0.0' });
    }
  }
});

export default router;
