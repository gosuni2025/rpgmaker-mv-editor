import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import projectManager from '../services/projectManager';

const router = express.Router();

const SETTINGS_FILE = 'ProjectSettings.json';

const DEFAULT_SETTINGS = {
  touchUI: true,
  screenWidth: 816,
  screenHeight: 624,
  fps: 60,
};

// GET /api/project-settings
router.get('/', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project open' });
    const filePath = path.join(projectManager.getDataPath(), SETTINGS_FILE);
    if (!fs.existsSync(filePath)) return res.json(DEFAULT_SETTINGS);
    const raw = fs.readFileSync(filePath, 'utf8');
    res.json(JSON.parse(raw));
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PUT /api/project-settings
router.put('/', (req: Request, res: Response) => {
  try {
    if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project open' });
    const filePath = path.join(projectManager.getDataPath(), SETTINGS_FILE);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
