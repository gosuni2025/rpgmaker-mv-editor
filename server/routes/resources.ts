import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import multer from 'multer';
import projectManager from '../services/projectManager';

const router = express.Router();

// Resolve resource type (e.g. "img_faces" → "img/faces", "audio_bgm" → "audio/bgm")
// Also handles legacy bare names: "faces" → "img/faces", "tilesets" → "img/tilesets"
function resolveResourceDir(type: string): string {
  const subPath = type.replace(/_/g, '/');
  const fullPath = path.join(projectManager.currentPath!, subPath);
  if (fs.existsSync(fullPath)) return fullPath;
  // Fallback: try prepending img/
  const imgPath = path.join(projectManager.currentPath!, 'img', subPath);
  if (fs.existsSync(imgPath)) return imgPath;
  return fullPath; // Return original (will 404 naturally)
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dirPath = resolveResourceDir(req.params.type as string);
      fs.mkdirSync(dirPath, { recursive: true });
      cb(null, dirPath);
    },
    filename: (_req, file, cb) => {
      cb(null, file.originalname);
    },
  }),
});

router.get('/:type', (req: Request<{ type: string }>, res: Response) => {
  try {
    const dirPath = resolveResourceDir(req.params.type);
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: 'Resource directory not found' });
    }
    const files = fs.readdirSync(dirPath).filter(f => !f.startsWith('.'));
    res.json(files);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:type/:name', (req: Request<{ type: string; name: string }>, res: Response) => {
  try {
    const filePath = path.join(resolveResourceDir(req.params.type), req.params.name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    res.sendFile(filePath);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Upload resource (POST /:type and POST /:type/upload both accepted)
router.post('/:type/upload', upload.single('file'), (req: Request<{ type: string }>, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ success: true, filename: req.file.originalname });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/:type', upload.single('file'), (req: Request<{ type: string }>, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ success: true, filename: req.file.originalname });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Open resource folder in file manager
router.post('/:type/open-folder', (req: Request<{ type: string }>, res: Response) => {
  try {
    const dirPath = resolveResourceDir(req.params.type);
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

// Delete resource
router.delete('/:type/:name', (req: Request<{ type: string; name: string }>, res: Response) => {
  try {
    const filePath = path.join(resolveResourceDir(req.params.type), req.params.name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
