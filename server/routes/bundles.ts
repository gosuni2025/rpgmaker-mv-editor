/**
 * /game/bundles/* — 리소스 번들 API
 *
 * GET /game/bundles/manifest.json  → 버전 + 번들 목록
 * GET /game/bundles/img.zip        → img/ 폴더 ZIP (동적 생성)
 * GET /game/bundles/audio.zip      → audio/ 폴더 ZIP
 * GET /game/bundles/data.zip       → data/ 폴더 ZIP
 *
 * ServiceWorker가 이 API를 통해 리소스를 묶어서 Cache API에 저장.
 * 이후 /game/img|audio|data/* 요청은 캐시에서 응답.
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import projectManager from '../services/projectManager';

const router = express.Router();

// manifest: 버전(프로젝트 폴더 mtime 기반) + 번들 목록
router.get('/manifest.json', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).json({ error: 'No project' });

  const projectPath = projectManager.currentPath!;
  let version: string;
  try {
    version = fs.statSync(projectPath).mtimeMs.toString(36);
  } catch {
    version = Date.now().toString(36);
  }

  res.json({
    version,
    bundles: ['img', 'audio', 'data'],
  });
});

// ZIP 번들 동적 생성 및 스트리밍
router.get('/:bundle.zip', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project');

  const { bundle } = req.params;
  if (!['img', 'audio', 'data'].includes(bundle)) return res.status(404).send('Not found');

  const projectPath = projectManager.currentPath!;
  const folderPath = path.join(projectPath, bundle);

  if (!fs.existsSync(folderPath)) return res.status(404).send('Not found');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${bundle}.zip"`);
  // 캐시: 5분 (SW가 버전 체크로 무효화 판단)
  res.setHeader('Cache-Control', 'public, max-age=300');

  const archive = archiver('zip', {
    zlib: { level: 0 }, // store-only: 이미지/오디오는 이미 압축됨, CPU 절약
  });

  archive.on('error', (err) => {
    if (!res.headersSent) res.status(500).send(err.message);
  });

  archive.pipe(res);
  archive.directory(folderPath, false);
  archive.finalize();
});

export default router;
