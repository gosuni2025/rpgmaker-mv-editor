/**
 * /game/bundles/* — 리소스 번들 API
 *
 * GET /game/bundles/manifest.json  → 버전 + 파일 목록
 *
 * ServiceWorker가 이 API를 통해 파일 목록을 받아 개별 fetch 후 Cache API에 저장.
 * 이후 /game/img|audio|data/* 요청은 캐시에서 응답.
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import projectManager from '../services/projectManager';

const router = express.Router();

function collectBundleFiles(projectPath: string): string[] {
  const files: string[] = [];

  function walk(dir: string, prefix: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const rel = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), rel);
      } else {
        files.push(rel.startsWith('/') ? rel.slice(1) : rel);
      }
    }
  }

  for (const dir of ['img', 'audio', 'data']) {
    walk(path.join(projectPath, dir), dir);
  }

  return files;
}

// manifest: 버전(프로젝트 폴더 mtime 기반) + 파일 목록
router.get('/manifest.json', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });

  const projectPath = projectManager.currentPath!;
  let version: string;
  try {
    version = fs.statSync(projectPath).mtimeMs.toString(36);
  } catch {
    version = Date.now().toString(36);
  }

  const files = collectBundleFiles(projectPath);

  res.json({ version, files });
});

export default router;
