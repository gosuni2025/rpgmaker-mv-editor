import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import projectManager from '../../services/projectManager';

export function registerMapDeleteRestoreRoutes(router: Router) {
  // DELETE /:id - 맵 삭제 (returns deleted data for undo)
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

      // Delete map file + ext file + event folder
      const filePath = path.join(projectManager.getDataPath(), mapFile);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      projectManager.deleteExtJSON(mapFile);
      projectManager.deleteEventFolder(id);

      res.json({ success: true, mapInfo, mapData, extData });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /restore - 삭제된 맵 복원
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

  // POST /:id/duplicate - 맵 복제
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

      // Copy event folder and update __ref paths to new map ID
      projectManager.copyEventFolder(sourceId, newId);
      const newIdStr2 = String(newId).padStart(3, '0');
      const newEventsArr = (newMapData.events as any[]) || [];
      const updatedEvents = newEventsArr.map((ev: any) => {
        if (!ev || !ev.__ref) return ev;
        // 파일명은 복사 후에도 동일 — 폴더 경로만 새 맵 ID로 교체
        const filename = (ev.__ref as string).split('/').pop() ?? '';
        return { id: ev.id, __ref: `Map${newIdStr2}/${filename}` };
      });
      if (newEventsArr.some((ev: any) => ev?.__ref)) {
        newMapData.events = updatedEvents;
        projectManager.writeJSON(newMapFile, newMapData);
      }

      res.json({ id: newId, mapInfo: newMapInfo });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
}
