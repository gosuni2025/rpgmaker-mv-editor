import { Router, Request, Response } from 'express';
import projectManager from '../../services/projectManager';
import * as l10n from '../../services/localizationManager';
import { EXTENSION_FIELDS, STRIP_ONLY_FIELDS } from './constants';

export function registerMapReadWriteRoutes(router: Router) {
  // GET / - 맵 목록
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

  // GET /:id - 개별 맵 읽기
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const idNum = parseInt(req.params.id as string, 10);
      const id = String(idNum).padStart(3, '0');
      const mapFile = `Map${id}.json`;
      const data = projectManager.readJSON(mapFile) as Record<string, unknown>;
      const ext = projectManager.readExtJSON(mapFile);
      // ext 데이터를 병합 (ext 우선)
      const merged = { ...data, ...ext };

      // events 배열의 __ref 마커 처리: 외부 파일에서 note/pages를 읽어서 병합 (__ref는 클라이언트에 그대로 전달)
      const events = (merged.events as any[]) || [];
      merged.events = events.map(ev => {
        if (!ev || !ev.__ref) return ev;
        try {
          const extEvent = projectManager.readEventFile(idNum, ev.id) as Record<string, unknown>;
          // note/pages는 외부 파일의 원본 값 사용 (맵 JSON의 note는 MV용 외부파일 안내 메시지)
          return { ...ev, note: extEvent.note ?? ev.note, pages: extEvent.pages };
        } catch {
          return ev; // 파일 없으면 마커만 반환
        }
      });

      res.json(merged);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return res.status(404).json({ error: 'Map not found' });
      }
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // PUT /:id - 맵 저장
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

      // events 배열 처리: __ref 있는 이벤트는 외부 파일로 저장
      const mapId = parseInt(req.params.id as string, 10);
      const events = (standardData.events as any[]) || [];
      standardData.events = events.map(ev => {
        if (!ev) return ev;
        const hasRef = !!ev.__ref;
        const { __ref: _ref, ...eventData } = ev as Record<string, unknown>;
        if (hasRef) {
          // pages가 없거나 비어있거나 stripped(list=[{code:0}]뿐)이면 기존 외부 파일에서 복원
          // stripped = 맵 자동저장 시 list를 제거한 상태. 외부 파일의 실제 커맨드를 보존하기 위해 복원.
          const isStripped = (pages: any[]) =>
            pages.length > 0 && pages.every((p: any) =>
              p.list && p.list.length === 1 && p.list[0].code === 0 &&
              p.list[0].indent === 0 && (p.list[0].parameters?.length ?? 0) === 0);
          let pagesForFile = eventData.pages as any[] | undefined;
          if (!pagesForFile || pagesForFile.length === 0 || isStripped(pagesForFile)) {
            try {
              const existing = projectManager.readEventFile(mapId, ev.id) as Record<string, unknown>;
              if (existing.pages) pagesForFile = existing.pages as any[];
            } catch { /* 외부 파일 없으면 무시 */ }
          }
          const eventDataWithPages = { ...eventData, pages: pagesForFile || [] };
          const newFilename = projectManager.writeEventFile(mapId, ev.id, ev.name || '', eventDataWithPages);
          const refPath = `Map${String(mapId).padStart(3, '0')}/${newFilename}`;
          // 페이지 메타데이터(이미지·조건·이동타입 등)는 유지, 실행 커맨드(list)만 제거
          const strippedPages = (pagesForFile || []).map((p: any) => ({
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
        } else {
          // 인라인으로 복귀 → 기존 외부 파일 삭제, 원본 note 복원
          projectManager.deleteEventFile(mapId, ev.id);
          return eventData;
        }
      });

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

  // POST /folder - 폴더 생성 (MapInfos entry + 빈 맵 파일)
  router.post('/folder', (req: Request, res: Response) => {
    try {
      const { name, parentId = 0 } = req.body;
      const mapInfos = projectManager.readJSON('MapInfos.json') as (null | { id: number; order: number })[];

      let newId = 1;
      for (let i = 1; i < mapInfos.length; i++) {
        if (mapInfos[i]) newId = Math.max(newId, mapInfos[i]!.id + 1);
      }

      let maxOrder = 0;
      for (const info of mapInfos) {
        if (info && info.order > maxOrder) maxOrder = info.order;
      }

      const mapInfo = {
        id: newId,
        expanded: true,
        name: name || '새 폴더',
        order: maxOrder + 1,
        parentId,
        scrollX: 0,
        scrollY: 0,
        isFolder: true,
      };

      while (mapInfos.length <= newId) mapInfos.push(null);
      mapInfos[newId] = mapInfo;
      projectManager.writeJSON('MapInfos.json', mapInfos);

      // 스팀판 MV 호환: 빈 맵 파일 생성 (폴더지만 MV는 일반 맵으로 인식)
      const idStr = String(newId).padStart(3, '0');
      const emptyMapData = {
        autoplayBgm: false, autoplayBgs: false,
        battleback1Name: '', battleback2Name: '',
        bgm: { name: '', pan: 0, pitch: 100, volume: 90 },
        bgs: { name: '', pan: 0, pitch: 100, volume: 90 },
        disableDashing: false, displayName: '',
        encounterList: [], encounterStep: 30,
        height: 13, note: '',
        parallaxLoopX: false, parallaxLoopY: false,
        parallaxName: '', parallaxShow: true,
        parallaxSx: 0, parallaxSy: 0,
        scrollType: 0, specifyBattleback: false,
        tilesetId: 1, width: 17,
        data: new Array(17 * 13 * 6).fill(0),
        events: [null],
      };
      projectManager.writeJSON(`Map${idStr}.json`, emptyMapData);

      res.json({ id: newId, mapInfo });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST / - 새 맵 생성
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

  // PUT / - MapInfos 업데이트 (for reorder, rename, etc.)
  router.put('/', (req: Request, res: Response) => {
    try {
      projectManager.writeJSON('MapInfos.json', req.body);
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
}
