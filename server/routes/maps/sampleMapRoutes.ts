import { Router, Request, Response } from 'express';
import path from 'path';
import projectManager from '../../services/projectManager';
import sampleMapExtractor from '../../services/sampleMapExtractor';

export function registerSampleMapRoutes(router: Router) {
  /** 샘플 맵 목록 */
  router.get('/sample-maps', (_req: Request, res: Response) => {
    try {
      const list = sampleMapExtractor.getMapList();
      if (!list) {
        return res.status(404).json({ error: 'RPG Maker MV binary not found' });
      }
      res.json(list);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /** 샘플 맵 상태 조회 */
  router.get('/sample-maps/status', (_req: Request, res: Response) => {
    try {
      const status = sampleMapExtractor.getStatus();
      res.json(status);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /** 샘플 맵 프리뷰 이미지 (바이너리에서 추출) */
  router.get('/sample-maps/:id/preview', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id) || id < 1 || id > 104) {
        return res.status(400).json({ error: 'Invalid sample map id' });
      }
      const preview = sampleMapExtractor.getPreview(id);
      if (!preview) {
        return res.status(404).json({ error: 'Preview not found' });
      }
      res.set('Content-Type', 'image/png');
      res.send(preview);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /** 샘플 맵 데이터 가져오기 */
  router.get('/sample-maps/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id) || id < 1 || id > 104) {
        return res.status(400).json({ error: 'Invalid sample map id' });
      }
      const data = sampleMapExtractor.getMapData(id);
      if (!data) {
        return res.status(404).json({ error: 'Sample map not found' });
      }
      res.json(data);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /** BaseResource → 프로젝트로 누락 이미지 복사 */
  router.post('/sample-maps/copy-resources', (_req: Request, res: Response) => {
    try {
      if (!projectManager.isOpen()) {
        return res.status(400).json({ error: 'No project open' });
      }
      const projectImgDir = path.join(projectManager.currentPath!, 'img');
      const copied = sampleMapExtractor.copyMissingResources(projectImgDir);
      res.json({ copied: copied.length, files: copied });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /** 바이너리 경로 설정 후 재로드 */
  router.post('/sample-maps/set-binary-path', (req: Request, res: Response) => {
    try {
      const { binaryPath } = req.body;
      if (!binaryPath || typeof binaryPath !== 'string') {
        return res.status(400).json({ error: 'binaryPath is required' });
      }
      sampleMapExtractor.setBinaryPath(binaryPath);
      const status = sampleMapExtractor.getStatus();
      if (!status.available) {
        return res.status(400).json({ error: 'Failed to extract maps from the specified binary' });
      }
      res.json({ success: true, count: status.count });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
}
