import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import projectManager from '../services/projectManager';
import * as l10n from '../services/localizationManager';
import sampleMapExtractor from '../services/sampleMapExtractor';

const router = express.Router();

/** ext 파일로 분리할 확장 필드 */
const EXTENSION_FIELDS = ['editorLights', 'objects', 'cameraZones', 'skyBackground', 'animTileSettings', 'bloomConfig', 'dofConfig', 'postProcessConfig', 'fogOfWar', 'testStartPosition', 'eventFoldState', 'tileLayerElevation', 'customPassage', 'npcData', 'is3D'];
/** 저장 시 제거만 하고 ext에도 넣지 않는 필드 */
const STRIP_ONLY_FIELDS = ['tilesetNames'];

router.get('/', (req: Request, res: Response) => {
  try {
    const data = projectManager.readJSON('MapInfos.json') as (null | { id: number; [key: string]: unknown })[];
    // 각 맵의 displayName을 Map파일에서 읽어 MapInfo에 포함
    const enriched = data.map((info) => {
      if (!info) return null;
      try {
        const filename = `Map${String(info.id).padStart(3, '0')}.json`;
        const mapData = projectManager.readJSON(filename) as { displayName?: string } | null;
        const displayName = mapData?.displayName ?? '';
        return displayName ? { ...info, displayName } : info;
      } catch {
        return info;
      }
    });
    res.json(enriched);
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
  // 데모 모드: 디스크 저장 차단 (클라이언트 state는 유지됨)
  if (process.env.DEMO_MODE === 'true') {
    return res.json({ success: true });
  }
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

// Delete map (returns deleted data for undo)
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const mapInfos = projectManager.readJSON('MapInfos.json') as (null | { id: number })[];

    if (!mapInfos[id]) {
      return res.status(404).json({ error: 'Map not found' });
    }

    // Capture data before deletion for undo
    const mapInfo = mapInfos[id];
    const idStr = String(id).padStart(3, '0');
    const mapFile = `Map${idStr}.json`;
    let mapData = null;
    let extData = null;
    try { mapData = projectManager.readJSON(mapFile); } catch {}
    try { extData = projectManager.readExtJSON(mapFile); } catch {}

    // Remove from MapInfos
    mapInfos[id] = null;
    projectManager.writeJSON('MapInfos.json', mapInfos);

    // Delete map file + ext file
    const filePath = path.join(projectManager.getDataPath(), mapFile);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    projectManager.deleteExtJSON(mapFile);

    res.json({ success: true, mapInfo, mapData, extData });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Restore deleted map
router.post('/restore', (req: Request, res: Response) => {
  try {
    const { mapId, mapInfo, mapData, extData } = req.body;
    if (!mapId || !mapInfo || !mapData) {
      return res.status(400).json({ error: 'Missing required fields: mapId, mapInfo, mapData' });
    }

    const mapInfos = projectManager.readJSON('MapInfos.json') as (null | any)[];

    // Extend array if needed
    while (mapInfos.length <= mapId) mapInfos.push(null);

    // Check if slot is already taken
    if (mapInfos[mapId]) {
      return res.status(409).json({ error: 'Map ID already exists' });
    }

    // Restore MapInfos entry
    mapInfos[mapId] = mapInfo;
    projectManager.writeJSON('MapInfos.json', mapInfos);

    // Restore map data file
    const idStr = String(mapId).padStart(3, '0');
    const mapFile = `Map${idStr}.json`;
    projectManager.writeJSON(mapFile, mapData);

    // Restore ext data file
    if (extData && Object.keys(extData).length > 0) {
      projectManager.writeExtJSON(mapFile, extData);
    }

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

// Duplicate map
router.post('/:id/duplicate', (req: Request, res: Response) => {
  try {
    const sourceId = parseInt(req.params.id as string, 10);
    const mapInfos = projectManager.readJSON('MapInfos.json') as (null | { id: number; name: string; order: number; parentId: number; expanded?: boolean; scrollX?: number; scrollY?: number })[];

    if (!mapInfos[sourceId]) {
      return res.status(404).json({ error: 'Source map not found' });
    }

    const sourceInfo = mapInfos[sourceId]!;
    const sourceIdStr = String(sourceId).padStart(3, '0');
    const sourceMapFile = `Map${sourceIdStr}.json`;

    // Read source map data
    let sourceMapData: Record<string, unknown>;
    try {
      sourceMapData = projectManager.readJSON(sourceMapFile) as Record<string, unknown>;
    } catch {
      return res.status(404).json({ error: 'Source map data not found' });
    }

    // Read source ext data
    let sourceExtData: Record<string, unknown> = {};
    try {
      sourceExtData = projectManager.readExtJSON(sourceMapFile);
    } catch { /* no ext data */ }

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

    // Generate unique name (add number suffix if duplicate)
    const existingNames = new Set<string>();
    for (const info of mapInfos) {
      if (info) existingNames.add(info.name);
    }

    let newName = sourceInfo.name;
    if (existingNames.has(newName)) {
      let suffix = 1;
      // Check if name already has a number suffix like "Name (1)"
      const match = newName.match(/^(.+?)\s*\((\d+)\)$/);
      if (match) {
        const baseName = match[1];
        suffix = parseInt(match[2], 10) + 1;
        while (existingNames.has(`${baseName} (${suffix})`)) {
          suffix++;
        }
        newName = `${baseName} (${suffix})`;
      } else {
        while (existingNames.has(`${newName} (${suffix})`)) {
          suffix++;
        }
        newName = `${newName} (${suffix})`;
      }
    }

    // Create new map info
    const newMapInfo = {
      id: newId,
      expanded: false,
      name: newName,
      order: maxOrder + 1,
      parentId: sourceInfo.parentId,
      scrollX: 0,
      scrollY: 0,
    };

    // Extend array if needed and add new map info
    while (mapInfos.length <= newId) mapInfos.push(null);
    mapInfos[newId] = newMapInfo;
    projectManager.writeJSON('MapInfos.json', mapInfos);

    // Copy map data (deep clone to avoid reference issues)
    const newMapData = JSON.parse(JSON.stringify(sourceMapData));
    // Reset events array to clear any event IDs that might conflict
    // Events are copied as-is since they're local to the map

    const newIdStr = String(newId).padStart(3, '0');
    const newMapFile = `Map${newIdStr}.json`;
    projectManager.writeJSON(newMapFile, newMapData);

    // Copy ext data if exists
    if (Object.keys(sourceExtData).length > 0) {
      const newExtData = JSON.parse(JSON.stringify(sourceExtData));
      // Remove test start position since it shouldn't be copied
      delete newExtData.testStartPosition;
      if (Object.keys(newExtData).length > 0) {
        projectManager.writeExtJSON(newMapFile, newExtData);
      }
    }

    res.json({ id: newId, mapInfo: newMapInfo });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
