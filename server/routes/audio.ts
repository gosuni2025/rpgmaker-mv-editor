import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import multer from 'multer';
import projectManager from '../services/projectManager';

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dirPath = path.join(projectManager.getAudioPath(), req.params.type as string);
      fs.mkdirSync(dirPath, { recursive: true });
      cb(null, dirPath);
    },
    filename: (_req, file, cb) => {
      cb(null, file.originalname);
    },
  }),
});

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

// Open audio folder in file manager
router.post('/:type/open-folder', (req: Request, res: Response) => {
  try {
    const dirPath = path.join(projectManager.getAudioPath(), req.params.type as string);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const cmd = process.platform === 'darwin' ? 'open'
      : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    exec(`${cmd} "${dirPath}"`);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Upload audio file
router.post('/:type', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ success: true, filename: req.file.originalname });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Delete audio file
router.delete('/:type/:name', (req: Request, res: Response) => {
  try {
    const filePath = path.join(projectManager.getAudioPath(), req.params.type as string, req.params.name as string);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
