import express, { Request, Response } from 'express';
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

export default router;
