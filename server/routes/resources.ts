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
  // 먼저 원본 이름 그대로 시도 (sv_actors 등 밑줄이 폴더명의 일부인 경우)
  const rawPath = path.join(projectManager.currentPath!, type);
  if (fs.existsSync(rawPath)) return rawPath;
  const rawImgPath = path.join(projectManager.currentPath!, 'img', type);
  if (fs.existsSync(rawImgPath)) return rawImgPath;
  // _를 /로 치환하여 시도 (img_faces → img/faces)
  const subPath = type.replace(/_/g, '/');
  const fullPath = path.join(projectManager.currentPath!, subPath);
  if (fs.existsSync(fullPath)) return fullPath;
  const imgPath = path.join(projectManager.currentPath!, 'img', subPath);
  if (fs.existsSync(imgPath)) return imgPath;
  return rawImgPath; // Return img/type path (will 404 naturally)
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

/** 디렉토리를 재귀적으로 읽어 파일 목록을 반환 (하위 폴더는 prefix/ 형태로 포함) */
function readDirRecursive(dirPath: string, prefix = ''): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const relName = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...readDirRecursive(path.join(dirPath, entry.name), relName));
    } else {
      results.push(relName);
    }
  }
  return results;
}

/** 디렉토리 1단계만 읽어 파일+폴더 목록 반환 (isDir 포함) */
function readDirShallow(dirPath: string): Array<{ name: string; size: number; mtime: number; isDir: boolean }> {
  const results = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      results.push({ name: entry.name, size: 0, mtime: 0, isDir: true });
    } else {
      try {
        const stat = fs.statSync(path.join(dirPath, entry.name));
        results.push({ name: entry.name, size: stat.size, mtime: stat.mtimeMs, isDir: false });
      } catch {
        results.push({ name: entry.name, size: 0, mtime: 0, isDir: false });
      }
    }
  }
  return results;
}

router.get('/:type', (req: Request<{ type: string }>, res: Response) => {
  try {
    const dirPath = resolveResourceDir(req.params.type);
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: 'Resource directory not found' });
    }

    // recursive=0: 지정된 subdir의 1단계 목록만 반환 (isDir 포함)
    if (req.query.recursive === '0') {
      const subdir = (req.query.subdir as string) || '';
      const targetDir = subdir ? path.join(dirPath, subdir) : dirPath;
      // 보안: dirPath 밖으로 나가지 않도록
      if (!path.resolve(targetDir).startsWith(path.resolve(dirPath))) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (!fs.existsSync(targetDir)) return res.status(404).json({ error: 'Directory not found' });
      return res.json(readDirShallow(targetDir));
    }

    const files = readDirRecursive(dirPath);
    // detail=1 파라미터가 있으면 파일 메타데이터 포함
    if (req.query.detail === '1') {
      const detailed = files.map(f => {
        try {
          const stat = fs.statSync(path.join(dirPath, f));
          return { name: f, size: stat.size, mtime: stat.mtimeMs };
        } catch {
          return { name: f, size: 0, mtime: 0 };
        }
      });
      return res.json(detailed);
    }
    res.json(files);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:type/:name(*)', (req: Request<{ type: string; name: string }>, res: Response) => {
  try {
    const filePath = path.join(resolveResourceDir(req.params.type), req.params.name);
    // 보안: resolveResourceDir 밖으로 나가지 못하도록 검사
    const resolved = path.resolve(filePath);
    const base = path.resolve(resolveResourceDir(req.params.type));
    if (!resolved.startsWith(base)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!fs.existsSync(filePath)) {
      // PNG ↔ WebP 폴백
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.png' || ext === '.webp') {
        const altExt = ext === '.png' ? '.webp' : '.png';
        const altPath = filePath.slice(0, -ext.length) + altExt;
        if (fs.existsSync(altPath)) {
          return res.sendFile(altPath);
        }
      }
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
