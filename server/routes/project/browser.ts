import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec, execSync } from 'child_process';

const router = express.Router();

router.get('/drives', (_req: Request, res: Response) => {
  if (process.platform !== 'win32') {
    return res.json({ drives: [] });
  }
  // PowerShell로 드라이브 목록 가져오기 (wmic은 Windows 11에서 제거됨)
  try {
    const output = execSync(
      'powershell -command "Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root"',
      { encoding: 'utf8', timeout: 5000 }
    );
    const drives = output.trim().split(/\r?\n/).map((d: string) => d.trim()).filter((d: string) => /^[A-Za-z]:\\$/.test(d));
    if (drives.length > 0) return res.json({ drives });
  } catch { /* fallback */ }
  // fallback: 알파벳 순회
  const drives: string[] = [];
  for (let i = 65; i <= 90; i++) {
    const drive = String.fromCharCode(i) + ':\\';
    try {
      fs.statSync(drive);
      drives.push(drive);
    } catch { /* drive not accessible */ }
  }
  res.json({ drives });
});

router.get('/browse', (req: Request, res: Response) => {
  try {
    let dirPath = (req.query.path as string) || os.homedir();
    dirPath = path.resolve(dirPath);

    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      return res.status(400).json({ error: 'Invalid directory' });
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const dirs: string[] = [];
    let isRpgProject = false;

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        dirs.push(entry.name);
      }
      if (entry.name === 'Game.rpgproject' || entry.name === 'game.rpgproject') {
        isRpgProject = true;
      }
    }

    if (!isRpgProject && fs.existsSync(path.join(dirPath, 'data', 'System.json'))) {
      isRpgProject = true;
    }

    dirs.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    res.json({
      path: dirPath,
      parent: path.dirname(dirPath),
      dirs,
      isRpgProject,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/reveal', (req: Request, res: Response) => {
  try {
    const { path: dirPath } = req.body;
    if (!dirPath || !fs.existsSync(dirPath)) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    const cmd = process.platform === 'darwin' ? 'open'
      : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    exec(`${cmd} "${dirPath}"`);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/mkdir', (req: Request, res: Response) => {
  try {
    const { path: dirPath, name } = req.body;
    if (!dirPath || !name) {
      return res.status(400).json({ error: 'path and name are required' });
    }
    if (/[/\\]/.test(name) || name === '.' || name === '..') {
      return res.status(400).json({ error: 'Invalid folder name' });
    }
    const fullPath = path.join(dirPath, name);
    if (fs.existsSync(fullPath)) {
      return res.status(400).json({ error: 'Folder already exists' });
    }
    fs.mkdirSync(fullPath, { recursive: true });
    res.json({ success: true, path: fullPath });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
