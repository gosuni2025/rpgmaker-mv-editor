import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import projectManager from '../services/projectManager';

const router = express.Router();

// GET /api/audio/:type - List audio files (bgm, bgs, me, se)
router.get('/:type', (req: Request, res: Response) => {
  try {
    const audioPath = path.join(projectManager.getAudioPath(), req.params.type as string);
    if (!fs.existsSync(audioPath)) return res.json([]);
    const files = fs.readdirSync(audioPath).filter(f => !f.startsWith('.'));
    res.json(files);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/audio/:type/:name - Serve audio file
router.get('/:type/:name', (req: Request, res: Response) => {
  try {
    const filePath = path.join(projectManager.getAudioPath(), req.params.type as string, req.params.name as string);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    res.sendFile(filePath);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
