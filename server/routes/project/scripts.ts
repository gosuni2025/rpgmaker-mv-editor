import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import projectManager from '../../services/projectManager';
import { collectJsFiles } from './helpers';

const router = express.Router();

router.get('/js-files', (req: Request, res: Response) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project open' });
  try {
    const relDir = (req.query.dir as string) || 'js';
    const absDir = path.join(projectManager.currentPath!, relDir);
    const files = collectJsFiles(absDir, relDir);
    res.json(files);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/js-file-content', (req: Request, res: Response) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project open' });
  try {
    const relPath = req.query.path as string;
    if (!relPath) return res.status(400).json({ error: 'path required' });
    const absPath = path.resolve(path.join(projectManager.currentPath!, relPath));
    if (!absPath.startsWith(path.resolve(projectManager.currentPath!))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!fs.existsSync(absPath)) return res.status(404).json({ error: 'File not found' });
    res.type('text/plain').send(fs.readFileSync(absPath, 'utf8'));
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/open-folder', (req: Request, res: Response) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project open' });
  try {
    const relPath = (req.body?.path as string) || '';
    const base = path.resolve(projectManager.currentPath!);
    const absPath = relPath ? path.resolve(path.join(base, relPath)) : base;
    if (!absPath.startsWith(base)) return res.status(403).json({ error: 'Forbidden' });
    let targetPath = absPath;
    if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
      targetPath = path.dirname(absPath);
    }
    if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });
    const cmd = process.platform === 'darwin' ? 'open'
      : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    exec(`${cmd} "${targetPath}"`);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
