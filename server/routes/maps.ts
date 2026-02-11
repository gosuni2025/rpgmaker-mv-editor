import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import projectManager from '../services/projectManager';
import * as l10n from '../services/localizationManager';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const data = projectManager.readJSON('MapInfos.json');
    res.json(data);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).padStart(3, '0');
    const data = projectManager.readJSON(`Map${id}.json`);
    res.json(data);
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
    projectManager.writeJSON(`Map${id}.json`, req.body);

    // Auto-sync localization CSV if initialized
    let l10nDiff = null;
    try {
      const config = l10n.getConfig();
      if (config) {
        const { diff } = l10n.syncMapCSV(parseInt(req.params.id, 10));
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
    const id = parseInt(req.params.id, 10);
    const mapInfos = projectManager.readJSON('MapInfos.json') as (null | { id: number })[];

    if (!mapInfos[id]) {
      return res.status(404).json({ error: 'Map not found' });
    }

    // Remove from MapInfos
    mapInfos[id] = null;
    projectManager.writeJSON('MapInfos.json', mapInfos);

    // Delete map file
    const idStr = String(id).padStart(3, '0');
    const filePath = path.join(projectManager.getDataPath(), `Map${idStr}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true });
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
