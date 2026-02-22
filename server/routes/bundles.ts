/**
 * /game/bundles/* — 리소스 번들 API (서버 모드 전용)
 *
 * GET /game/bundles/manifest.json     → 버전 + 번들 목록
 * GET /game/bundles/img.zip           → img/ 폴더 ZIP (동적 생성, store-only)
 * GET /game/bundles/audio.zip         → audio/ 폴더 ZIP
 * GET /game/bundles/data.zip          → data/ 폴더 ZIP
 * GET /game/bundles/jszip.min.js      → SW에서 importScripts로 로드하는 JSZip
 *
 * ServiceWorker가 ZIP을 다운로드 → JSZip으로 압축 해제 → Cache API 저장.
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

  // 존재하는 번들 폴더만 포함
  const allBundles = ['img', 'audio', 'data'];
  const bundles = allBundles.filter(d => fs.existsSync(path.join(projectPath, d)));

  res.json({ version, bundles });
});

// ZIP 번들 동적 생성 및 스트리밍 (level:0 store-only — 이미지/오디오는 이미 압축됨)
router.get('/:bundle.zip', (req, res) => {
  if (!projectManager.isOpen()) return res.status(404).send('No project');

  const { bundle } = req.params;
  if (!['img', 'audio', 'data'].includes(bundle)) return res.status(404).send('Not found');

  const folderPath = path.join(projectManager.currentPath!, bundle);
  if (!fs.existsSync(folderPath)) return res.status(404).send('Not found');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${bundle}.zip"`);
  res.setHeader('Cache-Control', 'public, max-age=300');

  const archive = archiver('zip', { zlib: { level: 0 } });
  archive.on('error', (err) => {
    if (!res.headersSent) res.status(500).send(err.message);
  });
  archive.pipe(res);
  archive.directory(folderPath, false);
  archive.finalize();
});

// JSZip 라이브러리 (SW에서 importScripts('bundles/jszip.min.js')로 로드)
router.get('/jszip.min.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(require.resolve('jszip/dist/jszip.min.js'));
});

export default router;
