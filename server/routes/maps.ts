import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import projectManager from '../services/projectManager';
import * as l10n from '../services/localizationManager';
import sampleMapExtractor from '../services/sampleMapExtractor';

const router = express.Router();

/** ext 파일로 분리할 확장 필드 */
const EXTENSION_FIELDS = ['editorLights', 'objects', 'cameraZones', 'skyBackground', 'animTileSettings', 'bloomConfig', 'postProcessConfig', 'fogOfWar', 'testStartPosition', 'eventFoldState', 'tileLayerElevation', 'customPassage'];
/** 저장 시 제거만 하고 ext에도 넣지 않는 필드 */
const STRIP_ONLY_FIELDS = ['tilesetNames'];

router.get('/', (req: Request, res: Response) => {
  try {
    const data = projectManager.readJSON('MapInfos.json');
    res.json(data);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── 샘플 맵 (로딩) API ── (NOTE: /:id 와일드카드보다 앞에 정의해야 함)

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

router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).padStart(3, '0');
    const mapFile = `Map${id}.json`;
    const data = projectManager.readJSON(mapFile) as Record<string, unknown>;
    const ext = projectManager.readExtJSON(mapFile);
    // ext 데이터를 병합 (ext 우선)
    const merged = { ...data, ...ext };
    res.json(merged);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return res.status(404).json({ error: 'Map not found' });
    }
    res.status(500).json({ error: (err as Error).message });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).padStart(3, '0');
    const mapFile = `Map${id}.json`;
    const body = req.body as Record<string, unknown>;

    // 확장 필드 분리
    const extData: Record<string, unknown> = {};
    const standardData = { ...body };
    for (const field of EXTENSION_FIELDS) {
      if (field in standardData) {
        extData[field] = standardData[field];
        delete standardData[field];
      }
    }
    // strip-only 필드 제거 (ext에도 넣지 않음)
    for (const field of STRIP_ONLY_FIELDS) {
      delete standardData[field];
    }

    projectManager.writeJSON(mapFile, standardData);
    projectManager.writeExtJSON(mapFile, extData);

    // Auto-sync localization CSV if initialized
    let l10nDiff = null;
    try {
      const config = l10n.getConfig();
      if (config) {
        const { diff } = l10n.syncMapCSV(parseInt(req.params.id as string, 10));
        if (diff.added.length || diff.modified.length || diff.deleted.length) {
          l10nDiff = diff;
        }
      }
    } catch { /* localization sync failure should not block save */ }

    res.json({ success: true, l10nDiff });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Create new map
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, width = 17, height = 13, tilesetId = 1, parentId = 0 } = req.body;
    const mapInfos = projectManager.readJSON('MapInfos.json') as (null | { id: number; order: number })[];

    // Find next available ID
    let newId = 1;
    for (let i = 1; i < mapInfos.length; i++) {
      if (mapInfos[i]) newId = Math.max(newId, mapInfos[i]!.id + 1);
    }

    // Find max order
    let maxOrder = 0;
    for (const info of mapInfos) {
      if (info && info.order > maxOrder) maxOrder = info.order;
    }

    const mapInfo = {
      id: newId,
      expanded: false,
      name: name || `MAP${String(newId).padStart(3, '0')}`,
      order: maxOrder + 1,
      parentId,
      scrollX: 0,
      scrollY: 0,
    };

    // Extend array if needed
    while (mapInfos.length <= newId) mapInfos.push(null);
    mapInfos[newId] = mapInfo;
    projectManager.writeJSON('MapInfos.json', mapInfos);

    // Create map data file
    const mapData = {
      autoplayBgm: false, autoplayBgs: false,
      battleback1Name: '', battleback2Name: '',
      bgm: { name: '', pan: 0, pitch: 100, volume: 90 },
      bgs: { name: '', pan: 0, pitch: 100, volume: 90 },
      disableDashing: false, displayName: '',
      encounterList: [], encounterStep: 30,
      height, note: '',
      parallaxLoopX: false, parallaxLoopY: false,
      parallaxName: '', parallaxShow: true,
      parallaxSx: 0, parallaxSy: 0,
      scrollType: 0, specifyBattleback: false,
      tilesetId, width,
      data: new Array(width * height * 6).fill(0),
      events: [null],
    };
    const idStr = String(newId).padStart(3, '0');
    projectManager.writeJSON(`Map${idStr}.json`, mapData);

    res.json({ id: newId, mapInfo });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Delete map
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const mapInfos = projectManager.readJSON('MapInfos.json') as (null | { id: number })[];

    if (!mapInfos[id]) {
      return res.status(404).json({ error: 'Map not found' });
    }

    // Remove from MapInfos
    mapInfos[id] = null;
    projectManager.writeJSON('MapInfos.json', mapInfos);

    // Delete map file + ext file
    const idStr = String(id).padStart(3, '0');
    const mapFile = `Map${idStr}.json`;
    const filePath = path.join(projectManager.getDataPath(), mapFile);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    projectManager.deleteExtJSON(mapFile);

    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Migrate: 기존 맵 파일 내 확장 데이터를 ext 파일로 분리
router.post('/migrate-extensions', (req: Request, res: Response) => {
  try {
    const mapInfos = projectManager.readJSON('MapInfos.json') as (null | { id: number })[];
    let migrated = 0;

    for (let i = 1; i < mapInfos.length; i++) {
      if (!mapInfos[i]) continue;
      const idStr = String(i).padStart(3, '0');
      const mapFile = `Map${idStr}.json`;
      try {
        const data = projectManager.readJSON(mapFile) as Record<string, unknown>;
        const extData: Record<string, unknown> = {};
        let hasExt = false;
        for (const field of EXTENSION_FIELDS) {
          if (field in data) {
            extData[field] = data[field];
            delete data[field];
            hasExt = true;
          }
        }
        if (hasExt) {
          projectManager.writeJSON(mapFile, data);
          projectManager.writeExtJSON(mapFile, extData);
          migrated++;
        }
      } catch { /* skip missing maps */ }
    }

    res.json({ success: true, migrated });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Update MapInfos (for reorder, rename, etc.)
router.put('/', (req: Request, res: Response) => {
  try {
    projectManager.writeJSON('MapInfos.json', req.body);
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
