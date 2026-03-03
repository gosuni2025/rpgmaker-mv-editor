import { Router, Request, Response } from 'express';
import projectManager from '../../services/projectManager';
import { EXTENSION_FIELDS } from './constants';

export function registerMigrationRoutes(router: Router) {
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

  // Migrate: 기존 이벤트를 모두 외부 파일로 분리
  router.post('/migrate-events', (req: Request, res: Response) => {
    if (process.env.DEMO_MODE === 'true') {
      return res.json({ success: true, migrated: 0 });
    }
    try {
      const mapInfos = projectManager.readJSON('MapInfos.json') as (null | { id: number })[];
      let migratedMaps = 0;
      let migratedEvents = 0;

      for (let i = 1; i < mapInfos.length; i++) {
        if (!mapInfos[i]) continue;
        const idStr = String(i).padStart(3, '0');
        const mapFile = `Map${idStr}.json`;
        try {
          const data = projectManager.readJSON(mapFile) as Record<string, unknown>;
          const events = (data.events as any[]) || [];
          let changed = false;

          data.events = events.map(ev => {
            if (!ev || ev.__ref) return ev; // null이거나 이미 분리된 이벤트는 스킵
            const { __ref: _r, ...eventData } = ev as Record<string, unknown>;
            const newFilename = projectManager.writeEventFile(i, ev.id, ev.name || '', eventData);
            const refPath = `Map${idStr}/${newFilename}`;
            migratedEvents++;
            changed = true;
            // 페이지 메타데이터(이미지·조건·이동타입 등)는 유지, 실행 커맨드(list)만 제거
            const strippedPages = (eventData.pages as any[] || []).map((p: any) => ({
              ...p,
              list: [{ code: 0, indent: 0, parameters: [] }],
            }));
            return {
              id: ev.id,
              name: ev.name || '',
              x: ev.x ?? 0,
              y: ev.y ?? 0,
              note: `[외부 파일] data/${refPath}`,  // MV 에디터 노트에 표시
              pages: strippedPages,
              __ref: refPath,
            };
          });

          if (changed) {
            projectManager.writeJSON(mapFile, data);
            migratedMaps++;
          }
        } catch { /* skip missing maps */ }
      }

      res.json({ success: true, migratedMaps, migratedEvents });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Unmigrate: 외부 파일 이벤트를 모두 맵 파일 안으로 복구
  router.post('/unmigrate-events', (req: Request, res: Response) => {
    if (process.env.DEMO_MODE === 'true') {
      return res.json({ success: true, unmigratedMaps: 0, unmigratedEvents: 0 });
    }
    try {
      const mapInfos = projectManager.readJSON('MapInfos.json') as (null | { id: number })[];
      let unmigratedMaps = 0;
      let unmigratedEvents = 0;

      for (let i = 1; i < mapInfos.length; i++) {
        if (!mapInfos[i]) continue;
        const idStr = String(i).padStart(3, '0');
        const mapFile = `Map${idStr}.json`;
        try {
          const data = projectManager.readJSON(mapFile) as Record<string, unknown>;
          const events = (data.events as any[]) || [];
          let changed = false;

          data.events = events.map(ev => {
            if (!ev || !ev.__ref) return ev;
            try {
              const extEvent = projectManager.readEventFile(i, ev.id) as Record<string, unknown>;
              const { __ref: _r, __note: _n, ...baseEvent } = ev as Record<string, unknown>;
              projectManager.deleteEventFile(i, ev.id);
              unmigratedEvents++;
              changed = true;
              return { ...baseEvent, pages: extEvent.pages };
            } catch {
              // 외부 파일 없으면 마커만 제거
              const { __ref: _r, __note: _n, ...baseEvent } = ev as Record<string, unknown>;
              changed = true;
              return baseEvent;
            }
          });

          if (changed) {
            projectManager.writeJSON(mapFile, data);
            projectManager.deleteEventFolder(i);
            unmigratedMaps++;
          }
        } catch { /* skip missing maps */ }
      }

      res.json({ success: true, unmigratedMaps, unmigratedEvents });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
}
