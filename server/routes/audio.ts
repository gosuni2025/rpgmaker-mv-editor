import express from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import multer from 'multer';
import projectManager from '../services/projectManager';
import { asyncHandler } from '../utils/asyncHandler';

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
router.get('/:type', asyncHandler((req, res) => {
  const audioPath = path.join(projectManager.getAudioPath(), req.params.type as string);
  if (!fs.existsSync(audioPath)) return res.json([]) as any;
  const files = fs.readdirSync(audioPath).filter(f => !f.startsWith('.'));
  res.json(files);
}));

// GET /api/audio/:type/:name - Serve audio file
router.get('/:type/:name', asyncHandler((req, res) => {
  const filePath = path.join(projectManager.getAudioPath(), req.params.type as string, req.params.name as string);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' }) as any;
  res.sendFile(filePath);
}));

// Open audio folder in file manager
router.post('/:type/open-folder', asyncHandler((req, res) => {
  const dirPath = path.join(projectManager.getAudioPath(), req.params.type as string);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  exec(`${cmd} "${dirPath}"`);
  res.json({ success: true });
}));

// Upload audio file
router.post('/:type', upload.single('file'), asyncHandler((req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' }) as any;
  }
  res.json({ success: true, filename: req.file.originalname });
}));

// Delete audio file
router.delete('/:type/:name', asyncHandler((req, res) => {
  const filePath = path.join(projectManager.getAudioPath(), req.params.type as string, req.params.name as string);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' }) as any;
  fs.unlinkSync(filePath);
  res.json({ success: true });
}));

export default router;
