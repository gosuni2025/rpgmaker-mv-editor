import express, { Request, Response } from 'express';
import { exec } from 'child_process';
import settingsManager from '../services/settingsManager';

const router = express.Router();

// GET /api/settings - 전체 설정 조회
router.get('/', (_req: Request, res: Response) => {
  const settings = settingsManager.get();
  const detectedSteamPath = settingsManager.getSteamPath();
  res.json({ ...settings, detectedSteamPath });
});

// PUT /api/settings - 설정 업데이트
router.put('/', (req: Request, res: Response) => {
  const updated = settingsManager.update(req.body);
  const detectedSteamPath = settingsManager.getSteamPath();
  res.json({ ...updated, detectedSteamPath });
});

// POST /api/settings/open-folder - Steam 경로 폴더 열기
router.post('/open-folder', (_req: Request, res: Response) => {
  const steamPath = settingsManager.getSteamPath();
  if (!steamPath) {
    return res.status(404).json({ error: 'Steam path not found' });
  }
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  exec(`${cmd} "${steamPath}"`);
  res.json({ success: true });
});

export default router;
