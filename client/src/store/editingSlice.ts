import type { MapData, MapObject, CameraZone } from '../types/rpgMakerMV';
import { resizeMapData, resizeEvents } from '../utils/mapResize';
import { isAutotile, isTileA5, getAutotileKindExported, makeAutotileId, computeAutoShapeForPosition } from '../utils/tileHelper';
import type { EditorState, SliceCreator, TileChange, TileHistoryEntry, ResizeHistoryEntry, ObjectHistoryEntry, LightHistoryEntry, CameraZoneHistoryEntry } from './types';

/**
 * 변경된 타일 위치 + 인접 타일의 오토타일 shape를 재계산.
 * data 배열을 직접 수정하고, 추가 변경사항을 changes에 추가.
 */
function recalcAutotiles(
  data: number[], width: number, height: number,
  affectedPositions: { x: number; y: number; z: number }[],
  changes: TileChange[],
) {
  // 재계산 대상 수집 (변경 위치 + 인접 타일)
  const toRecalc = new Set<string>();
  for (const { x, y, z } of affectedPositions) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          toRecalc.add(`${nx},${ny},${z}`);
        }
      }
    }
  }

  for (const key of toRecalc) {
    const [px, py, pz] = key.split(',').map(Number);
    const idx = (pz * height + py) * width + px;
    const tid = data[idx];
    if (!isAutotile(tid) || isTileA5(tid)) continue;
    const kind = getAutotileKindExported(tid);
    const shape = computeAutoShapeForPosition(data, width, height, px, py, pz, tid);
    const correctId = makeAutotileId(kind, shape);
    if (correctId !== tid) {
      changes.push({ x: px, y: py, z: pz, oldTileId: tid, newTileId: correctId });
      data[idx] = correctId;
    }
  }
}

export const editingSlice: SliceCreator<Pick<EditorState,
  'editMode' | 'selectedTool' | 'selectedTileId' | 'selectedTiles' | 'selectedTilesWidth' | 'selectedTilesHeight' |
  'currentLayer' | 'clipboard' | 'cursorTileX' | 'cursorTileY' | 'selectionStart' | 'selectionEnd' | 'isPasting' | 'pastePreviewPos' |
  'selectedEventId' | 'selectedEventIds' | 'eventSelectionStart' | 'eventSelectionEnd' | 'isEventPasting' | 'eventPastePreviewPos' |
  'selectedObjectId' | 'selectedCameraZoneId' | 'undoStack' | 'redoStack' |
  'updateMapTile' | 'updateMapTiles' | 'pushUndo' | 'undo' | 'redo' | 'resizeMap' |
  'copyTiles' | 'cutTiles' | 'pasteTiles' | 'deleteTiles' | 'moveTiles' |
  'copyEvent' | 'cutEvent' | 'pasteEvent' | 'deleteEvent' |
  'copyEvents' | 'pasteEvents' | 'deleteEvents' | 'moveEvents' |
  'setSelectedEventIds' | 'setEventSelectionStart' | 'setEventSelectionEnd' | 'setIsEventPasting' | 'setEventPastePreviewPos' | 'clearEventSelection' |
  'setSelectedObjectId' | 'addObject' | 'updateObject' | 'deleteObject' |
  'setSelectedCameraZoneId' | 'addCameraZone' | 'updateCameraZone' | 'deleteCameraZone' |
  'setEditMode' | 'setSelectedTool' | 'setSelectedTileId' | 'setSelectedTiles' |
  'setCurrentLayer' | 'setCursorTile' | 'setSelection' | 'setIsPasting' | 'setPastePreviewPos' | 'clearSelection' | 'setSelectedEventId'
>> = (set, get) => ({
  editMode: 'map',
  selectedTool: 'pen',
  selectedTileId: 0,
  selectedTiles: null,
  selectedTilesWidth: 1,
  selectedTilesHeight: 1,
  currentLayer: 0,
  clipboard: null,
  cursorTileX: 0,
  cursorTileY: 0,
  selectionStart: null,
  selectionEnd: null,
  isPasting: false,
  pastePreviewPos: null,
  selectedEventId: null,
  selectedEventIds: [],
  eventSelectionStart: null,
  eventSelectionEnd: null,
  isEventPasting: false,
  eventPastePreviewPos: null,
  selectedObjectId: null,
  selectedCameraZoneId: null,
  undoStack: [],
  redoStack: [],

  // Map editing
  updateMapTile: (x: number, y: number, z: number, tileId: number) => {
    const map = get().currentMap;
    if (!map) return;
    const newData = [...map.data];
    newData[(z * map.height + y) * map.width + x] = tileId;
    set({ currentMap: { ...map, data: newData } });
  },

  updateMapTiles: (changes: { x: number; y: number; z: number; tileId: number }[]) => {
    const map = get().currentMap;
    if (!map) return;
    const newData = [...map.data];
    for (const c of changes) {
      newData[(c.z * map.height + c.y) * map.width + c.x] = c.tileId;
    }
    set({ currentMap: { ...map, data: newData } });
  },

  pushUndo: (changes: TileChange[]) => {
    const { currentMapId, undoStack } = get();
    if (!currentMapId || changes.length === 0) return;
    // 동일 좌표+레이어의 중복 변경을 병합: 첫 번째 oldTileId + 마지막 newTileId 유지
    const merged = new Map<string, TileChange>();
    for (const c of changes) {
      const key = `${c.x},${c.y},${c.z}`;
      const existing = merged.get(key);
      if (existing) {
        existing.newTileId = c.newTileId;
      } else {
        merged.set(key, { ...c });
      }
    }
    const mergedChanges = [...merged.values()].filter(c => c.oldTileId !== c.newTileId);
    if (mergedChanges.length === 0) return;
    const newStack = [...undoStack, { mapId: currentMapId, changes: mergedChanges } as TileHistoryEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({ undoStack: newStack, redoStack: [] });
  },

  undo: () => {
    const { undoStack, currentMap, currentMapId, showToast } = get();
    if (undoStack.length === 0 || !currentMap || !currentMapId) return;
    const entry = undoStack[undoStack.length - 1];
    if (entry.mapId !== currentMapId) return;

    if (entry.type === 'resize') {
      const re = entry as ResizeHistoryEntry;
      const redoEntry: ResizeHistoryEntry = {
        mapId: currentMapId,
        type: 'resize',
        oldWidth: re.newWidth, oldHeight: re.newHeight, oldData: re.newData, oldEvents: re.newEvents,
        newWidth: re.oldWidth, newHeight: re.oldHeight, newData: re.oldData, newEvents: re.oldEvents,
      };
      set({
        currentMap: { ...currentMap, width: re.oldWidth, height: re.oldHeight, data: re.oldData, events: re.oldEvents },
        undoStack: undoStack.slice(0, -1),
        redoStack: [...get().redoStack, redoEntry],
      });
      showToast(`실행 취소 (맵 크기 ${re.oldWidth}x${re.oldHeight})`);
      return;
    }

    if (entry.type === 'object') {
      const oe = entry as ObjectHistoryEntry;
      const redoEntry: ObjectHistoryEntry = {
        mapId: currentMapId, type: 'object',
        oldObjects: oe.newObjects, newObjects: oe.oldObjects,
        oldSelectedObjectId: get().selectedObjectId,
      };
      set({
        currentMap: { ...currentMap, objects: oe.oldObjects },
        selectedObjectId: oe.oldSelectedObjectId,
        undoStack: undoStack.slice(0, -1),
        redoStack: [...get().redoStack, redoEntry],
      });
      showToast('실행 취소 (오브젝트)');
      return;
    }

    if (entry.type === 'light') {
      const le = entry as LightHistoryEntry;
      const redoEntry: LightHistoryEntry = {
        mapId: currentMapId, type: 'light',
        oldLights: le.newLights, newLights: le.oldLights,
        oldSelectedLightId: get().selectedLightId,
      };
      set({
        currentMap: { ...currentMap, editorLights: le.oldLights },
        selectedLightId: le.oldSelectedLightId,
        undoStack: undoStack.slice(0, -1),
        redoStack: [...get().redoStack, redoEntry],
      });
      showToast('실행 취소 (조명)');
      return;
    }

    if (entry.type === 'cameraZone') {
      const cze = entry as CameraZoneHistoryEntry;
      const redoEntry: CameraZoneHistoryEntry = {
        mapId: currentMapId, type: 'cameraZone',
        oldZones: cze.newZones, newZones: cze.oldZones,
        oldSelectedCameraZoneId: get().selectedCameraZoneId,
      };
      set({
        currentMap: { ...currentMap, cameraZones: cze.oldZones },
        selectedCameraZoneId: cze.oldSelectedCameraZoneId,
        undoStack: undoStack.slice(0, -1),
        redoStack: [...get().redoStack, redoEntry],
      });
      showToast('실행 취소 (카메라 영역)');
      return;
    }

    const te = entry as TileHistoryEntry;
    const newData = [...currentMap.data];
    const redoChanges: TileChange[] = [];
    for (const c of te.changes) {
      const idx = (c.z * currentMap.height + c.y) * currentMap.width + c.x;
      redoChanges.push({ ...c, oldTileId: c.newTileId, newTileId: c.oldTileId });
      newData[idx] = c.oldTileId;
    }

    set({
      currentMap: { ...currentMap, data: newData },
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, { mapId: currentMapId, changes: redoChanges } as TileHistoryEntry],
    });
    showToast(`실행 취소 (타일 ${te.changes.length}개 변경)`);
  },

  redo: () => {
    const { redoStack, currentMap, currentMapId, showToast } = get();
    if (redoStack.length === 0 || !currentMap || !currentMapId) return;
    const entry = redoStack[redoStack.length - 1];
    if (entry.mapId !== currentMapId) return;

    if (entry.type === 'resize') {
      const re = entry as ResizeHistoryEntry;
      const undoEntry: ResizeHistoryEntry = {
        mapId: currentMapId,
        type: 'resize',
        oldWidth: re.newWidth, oldHeight: re.newHeight, oldData: re.newData, oldEvents: re.newEvents,
        newWidth: re.oldWidth, newHeight: re.oldHeight, newData: re.oldData, newEvents: re.oldEvents,
      };
      set({
        currentMap: { ...currentMap, width: re.oldWidth, height: re.oldHeight, data: re.oldData, events: re.oldEvents },
        redoStack: redoStack.slice(0, -1),
        undoStack: [...get().undoStack, undoEntry],
      });
      showToast(`다시 실행 (맵 크기 ${re.oldWidth}x${re.oldHeight})`);
      return;
    }

    if (entry.type === 'object') {
      const oe = entry as ObjectHistoryEntry;
      const undoEntry: ObjectHistoryEntry = {
        mapId: currentMapId, type: 'object',
        oldObjects: oe.newObjects, newObjects: oe.oldObjects,
        oldSelectedObjectId: get().selectedObjectId,
      };
      set({
        currentMap: { ...currentMap, objects: oe.oldObjects },
        selectedObjectId: oe.oldSelectedObjectId,
        redoStack: redoStack.slice(0, -1),
        undoStack: [...get().undoStack, undoEntry],
      });
      showToast('다시 실행 (오브젝트)');
      return;
    }

    if (entry.type === 'light') {
      const le = entry as LightHistoryEntry;
      const undoEntry: LightHistoryEntry = {
        mapId: currentMapId, type: 'light',
        oldLights: le.newLights, newLights: le.oldLights,
        oldSelectedLightId: get().selectedLightId,
      };
      set({
        currentMap: { ...currentMap, editorLights: le.oldLights },
        selectedLightId: le.oldSelectedLightId,
        redoStack: redoStack.slice(0, -1),
        undoStack: [...get().undoStack, undoEntry],
      });
      showToast('다시 실행 (조명)');
      return;
    }

    if (entry.type === 'cameraZone') {
      const cze = entry as CameraZoneHistoryEntry;
      const undoEntry: CameraZoneHistoryEntry = {
        mapId: currentMapId, type: 'cameraZone',
        oldZones: cze.newZones, newZones: cze.oldZones,
        oldSelectedCameraZoneId: get().selectedCameraZoneId,
      };
      set({
        currentMap: { ...currentMap, cameraZones: cze.oldZones },
        selectedCameraZoneId: cze.oldSelectedCameraZoneId,
        redoStack: redoStack.slice(0, -1),
        undoStack: [...get().undoStack, undoEntry],
      });
      showToast('다시 실행 (카메라 영역)');
      return;
    }

    const te = entry as TileHistoryEntry;
    const newData = [...currentMap.data];
    const undoChanges: TileChange[] = [];
    for (const c of te.changes) {
      const idx = (c.z * currentMap.height + c.y) * currentMap.width + c.x;
      undoChanges.push({ ...c, oldTileId: c.newTileId, newTileId: c.oldTileId });
      newData[idx] = c.newTileId;
    }

    set({
      currentMap: { ...currentMap, data: newData },
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, { mapId: currentMapId, changes: undoChanges } as TileHistoryEntry],
    });
    showToast(`다시 실행 (타일 ${te.changes.length}개 변경)`);
  },

  resizeMap: (newWidth: number, newHeight: number, offsetX: number, offsetY: number) => {
    const { currentMap, currentMapId, undoStack, showToast } = get();
    if (!currentMap || !currentMapId) return;
    const { width: oldW, height: oldH, data: oldData, events: oldEvents } = currentMap;
    if (newWidth === oldW && newHeight === oldH && offsetX === 0 && offsetY === 0) return;
    const nw = Math.max(1, Math.min(256, newWidth));
    const nh = Math.max(1, Math.min(256, newHeight));
    const newData = resizeMapData(oldData, oldW, oldH, nw, nh, offsetX, offsetY);
    const newEvents = resizeEvents(oldEvents, nw, nh, offsetX, offsetY);
    const historyEntry: ResizeHistoryEntry = {
      mapId: currentMapId,
      type: 'resize',
      oldWidth: oldW, oldHeight: oldH, oldData, oldEvents,
      newWidth: nw, newHeight: nh, newData, newEvents,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({
      currentMap: { ...currentMap, width: nw, height: nh, data: newData, events: newEvents },
      undoStack: newStack,
      redoStack: [],
    });
    showToast(`맵 크기 변경 ${oldW}x${oldH} → ${nw}x${nh}`);
  },

  // Clipboard - tiles
  copyTiles: (x1: number, y1: number, x2: number, y2: number) => {
    const map = get().currentMap;
    if (!map) return;
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const tiles: { x: number; y: number; z: number; tileId: number }[] = [];
    for (let z = 0; z < 4; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const tileId = map.data[(z * map.height + y) * map.width + x];
          tiles.push({ x: x - minX, y: y - minY, z, tileId });
        }
      }
    }
    set({ clipboard: { type: 'tiles', tiles, width: maxX - minX + 1, height: maxY - minY + 1 } });
  },

  cutTiles: (x1: number, y1: number, x2: number, y2: number) => {
    get().copyTiles(x1, y1, x2, y2);
    get().deleteTiles(x1, y1, x2, y2);
  },

  pasteTiles: (x: number, y: number) => {
    const { clipboard, currentMap } = get();
    if (!clipboard || clipboard.type !== 'tiles' || !clipboard.tiles || !currentMap) return;
    const changes: TileChange[] = [];
    const newData = [...currentMap.data];
    const affected: { x: number; y: number; z: number }[] = [];
    for (const t of clipboard.tiles) {
      const tx = x + t.x, ty = y + t.y;
      if (tx < 0 || tx >= currentMap.width || ty < 0 || ty >= currentMap.height) continue;
      const idx = (t.z * currentMap.height + ty) * currentMap.width + tx;
      changes.push({ x: tx, y: ty, z: t.z, oldTileId: newData[idx], newTileId: t.tileId });
      newData[idx] = t.tileId;
      affected.push({ x: tx, y: ty, z: t.z });
    }
    recalcAutotiles(newData, currentMap.width, currentMap.height, affected, changes);
    set({ currentMap: { ...currentMap, data: newData } });
    get().pushUndo(changes);
  },

  deleteTiles: (x1: number, y1: number, x2: number, y2: number) => {
    const map = get().currentMap;
    if (!map) return;
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const changes: TileChange[] = [];
    const newData = [...map.data];
    const affected: { x: number; y: number; z: number }[] = [];
    for (let z = 0; z < 4; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const idx = (z * map.height + y) * map.width + x;
          if (newData[idx] !== 0) {
            changes.push({ x, y, z, oldTileId: newData[idx], newTileId: 0 });
            newData[idx] = 0;
            affected.push({ x, y, z });
          }
        }
      }
    }
    recalcAutotiles(newData, map.width, map.height, affected, changes);
    set({ currentMap: { ...map, data: newData } });
    get().pushUndo(changes);
  },

  moveTiles: (srcX1: number, srcY1: number, srcX2: number, srcY2: number, destX: number, destY: number) => {
    const { clipboard, currentMap } = get();
    if (!currentMap || !clipboard || clipboard.type !== 'tiles' || !clipboard.tiles) return;
    const minX = Math.min(srcX1, srcX2), maxX = Math.max(srcX1, srcX2);
    const minY = Math.min(srcY1, srcY2), maxY = Math.max(srcY1, srcY2);
    const allChanges: TileChange[] = [];
    const newData = [...currentMap.data];

    // clipboard에서 원본 타일의 실제 데이터를 맵으로 구성 (mouseDown에서 이미 삭제되었으므로)
    const origTileMap = new Map<string, number>();
    for (const t of clipboard.tiles) {
      const ox = minX + t.x, oy = minY + t.y;
      origTileMap.set(`${ox},${oy},${t.z}`, t.tileId);
    }

    // 1. 원본 영역 삭제 (oldTileId는 clipboard의 실제 데이터 사용)
    for (let z = 0; z < 4; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const origTileId = origTileMap.get(`${x},${y},${z}`) ?? 0;
          if (origTileId !== 0) {
            allChanges.push({ x, y, z, oldTileId: origTileId, newTileId: 0 });
          }
          const idx = (z * currentMap.height + y) * currentMap.width + x;
          newData[idx] = 0;
        }
      }
    }
    // 2. 새 위치에 붙여넣기
    const affected: { x: number; y: number; z: number }[] = [];
    for (const t of clipboard.tiles) {
      const tx = destX + t.x, ty = destY + t.y;
      if (tx < 0 || tx >= currentMap.width || ty < 0 || ty >= currentMap.height) continue;
      const idx = (t.z * currentMap.height + ty) * currentMap.width + tx;
      allChanges.push({ x: tx, y: ty, z: t.z, oldTileId: newData[idx], newTileId: t.tileId });
      newData[idx] = t.tileId;
      affected.push({ x: tx, y: ty, z: t.z });
    }
    // 원본 영역도 affected에 추가 (주변 오토타일 재계산용)
    for (let z = 0; z < 4; z++) {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          affected.push({ x, y, z });
        }
      }
    }
    recalcAutotiles(newData, currentMap.width, currentMap.height, affected, allChanges);
    set({ currentMap: { ...currentMap, data: newData } });
    get().pushUndo(allChanges);
  },

  // Clipboard - events
  copyEvent: (eventId: number) => {
    const map = get().currentMap;
    if (!map || !map.events) return;
    const ev = map.events.find((e) => e && e.id === eventId);
    if (ev) set({ clipboard: { type: 'event', event: JSON.parse(JSON.stringify(ev)) } });
  },

  cutEvent: (eventId: number) => {
    get().copyEvent(eventId);
    get().deleteEvent(eventId);
  },

  pasteEvent: (x: number, y: number) => {
    const { clipboard, currentMap } = get();
    if (!clipboard || clipboard.type !== 'event' || !clipboard.event || !currentMap) return;
    const events = [...(currentMap.events || [])];
    const maxId = events.reduce((max, e) => (e && e.id > max ? e.id : max), 0);
    const newEvent = { ...(clipboard.event as Record<string, unknown>), id: maxId + 1, x, y };
    while (events.length <= maxId + 1) events.push(null);
    events[maxId + 1] = newEvent as MapData['events'][0];
    set({ currentMap: { ...currentMap, events } });
  },

  deleteEvent: (eventId: number) => {
    const map = get().currentMap;
    if (!map || !map.events) return;
    const events = map.events.map((e) => (e && e.id === eventId ? null : e));
    set({ currentMap: { ...map, events } });
  },

  // Multi-event actions
  copyEvents: (eventIds: number[]) => {
    const map = get().currentMap;
    if (!map || !map.events || eventIds.length === 0) return;
    const evts = eventIds
      .map(id => map.events.find(e => e && e.id === id))
      .filter((e): e is NonNullable<typeof e> => !!e);
    if (evts.length === 0) return;
    set({ clipboard: { type: 'events', events: JSON.parse(JSON.stringify(evts)) } });
  },

  pasteEvents: (x: number, y: number) => {
    const { clipboard, currentMap } = get();
    if (!currentMap) return;
    let evts: any[] | undefined;
    if (clipboard?.type === 'events' && clipboard.events) {
      evts = clipboard.events as any[];
    } else if (clipboard?.type === 'event' && clipboard.event) {
      evts = [clipboard.event];
    }
    if (!evts || evts.length === 0) return;
    // 원본 이벤트들의 좌상단 기준으로 오프셋 계산
    const minX = Math.min(...evts.map((e: any) => e.x));
    const minY = Math.min(...evts.map((e: any) => e.y));
    const events = [...(currentMap.events || [])];
    let maxId = events.reduce((max, e) => (e && e.id > max ? e.id : max), 0);
    const newIds: number[] = [];
    for (const evt of evts) {
      const newId = ++maxId;
      const nx = x + ((evt as any).x - minX);
      const ny = y + ((evt as any).y - minY);
      // 해당 위치에 이미 이벤트가 있으면 스킵
      const occupied = events.some(e => e && e.id !== 0 && e.x === nx && e.y === ny);
      if (occupied) continue;
      const newEvent = { ...(evt as any), id: newId, x: nx, y: ny };
      while (events.length <= newId) events.push(null);
      events[newId] = newEvent as MapData['events'][0];
      newIds.push(newId);
    }
    set({ currentMap: { ...currentMap, events }, selectedEventIds: newIds, selectedEventId: newIds[0] ?? null });
  },

  deleteEvents: (eventIds: number[]) => {
    const map = get().currentMap;
    if (!map || !map.events || eventIds.length === 0) return;
    const idSet = new Set(eventIds);
    const events = map.events.map(e => (e && idSet.has(e.id) ? null : e));
    set({ currentMap: { ...map, events }, selectedEventIds: [], selectedEventId: null });
  },

  moveEvents: (eventIds: number[], dx: number, dy: number) => {
    const map = get().currentMap;
    if (!map || !map.events || eventIds.length === 0) return;
    if (dx === 0 && dy === 0) return;
    const idSet = new Set(eventIds);
    // 이동 대상 위치에 다른 이벤트가 있는지 확인
    const movingEvents = map.events.filter(e => e && idSet.has(e.id));
    const newPositions = movingEvents.map(e => ({ x: e!.x + dx, y: e!.y + dy }));
    // 맵 범위 체크
    if (newPositions.some(p => p.x < 0 || p.x >= map.width || p.y < 0 || p.y >= map.height)) return;
    // 이동하지 않는 이벤트와 겹치는지 확인
    const nonMoving = map.events.filter(e => e && e.id !== 0 && !idSet.has(e.id));
    for (const np of newPositions) {
      if (nonMoving.some(e => e!.x === np.x && e!.y === np.y)) return;
    }
    // 이동 대상끼리 겹치는지 확인
    const posSet = new Set(newPositions.map(p => `${p.x},${p.y}`));
    if (posSet.size !== newPositions.length) return;

    const events = map.events.map(e => {
      if (e && idSet.has(e.id)) {
        return { ...e, x: e.x + dx, y: e.y + dy };
      }
      return e;
    });
    set({ currentMap: { ...map, events } });
  },

  setSelectedEventIds: (ids: number[]) => set({ selectedEventIds: ids }),
  setEventSelectionStart: (pos) => set({ eventSelectionStart: pos }),
  setEventSelectionEnd: (pos) => set({ eventSelectionEnd: pos }),
  setIsEventPasting: (isPasting: boolean) => set({ isEventPasting: isPasting }),
  setEventPastePreviewPos: (pos) => set({ eventPastePreviewPos: pos }),
  clearEventSelection: () => set({ eventSelectionStart: null, eventSelectionEnd: null, selectedEventIds: [], selectedEventId: null, isEventPasting: false, eventPastePreviewPos: null }),

  // Object actions
  setSelectedObjectId: (id: number | null) => set({ selectedObjectId: id }),

  addObject: (x: number, y: number) => {
    const { currentMap, currentMapId, selectedTiles, selectedTilesWidth, selectedTilesHeight, selectedTileId, undoStack, selectedObjectId } = get();
    if (!currentMap || !currentMapId) return;
    const oldObjects = currentMap.objects || [];
    const objects = [...oldObjects];
    const newId = objects.length > 0 ? Math.max(...objects.map(o => o.id)) + 1 : 1;
    let tileIds: number[][];
    let w: number, h: number;
    if (selectedTiles && selectedTilesWidth > 0 && selectedTilesHeight > 0) {
      tileIds = selectedTiles.map(row => [...row]);
      w = selectedTilesWidth;
      h = selectedTilesHeight;
    } else {
      tileIds = [[selectedTileId]];
      w = 1;
      h = 1;
    }
    const passability: boolean[][] = [];
    for (let row = 0; row < h; row++) {
      passability.push(Array(w).fill(row < h - 1));
    }
    const newObj: MapObject = {
      id: newId,
      name: `OBJ${newId}`,
      x,
      y,
      tileIds,
      width: w,
      height: h,
      zHeight: 0,
      passability,
    };
    objects.push(newObj);
    const historyEntry: ObjectHistoryEntry = {
      mapId: currentMapId, type: 'object',
      oldObjects: oldObjects, newObjects: objects,
      oldSelectedObjectId: selectedObjectId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({
      currentMap: { ...currentMap, objects },
      selectedObjectId: newId,
      undoStack: newStack,
      redoStack: [],
    });
  },

  updateObject: (id: number, updates: Partial<MapObject>) => {
    const { currentMap, currentMapId, undoStack, selectedObjectId } = get();
    if (!currentMap || !currentMapId || !currentMap.objects) return;
    const oldObjects = currentMap.objects;
    const objects = oldObjects.map(o => o.id === id ? { ...o, ...updates } : o);
    const historyEntry: ObjectHistoryEntry = {
      mapId: currentMapId, type: 'object',
      oldObjects, newObjects: objects,
      oldSelectedObjectId: selectedObjectId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({
      currentMap: { ...currentMap, objects },
      undoStack: newStack,
      redoStack: [],
    });
  },

  deleteObject: (id: number) => {
    const { currentMap, currentMapId, undoStack, selectedObjectId } = get();
    if (!currentMap || !currentMapId || !currentMap.objects) return;
    const oldObjects = currentMap.objects;
    const objects = oldObjects.filter(o => o.id !== id);
    const historyEntry: ObjectHistoryEntry = {
      mapId: currentMapId, type: 'object',
      oldObjects, newObjects: objects,
      oldSelectedObjectId: selectedObjectId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({
      currentMap: { ...currentMap, objects },
      selectedObjectId: selectedObjectId === id ? null : selectedObjectId,
      undoStack: newStack,
      redoStack: [],
    });
  },

  // Camera zone actions
  setSelectedCameraZoneId: (id: number | null) => set({ selectedCameraZoneId: id }),

  addCameraZone: (x: number, y: number, width: number, height: number) => {
    const { currentMap, currentMapId, undoStack, selectedCameraZoneId } = get();
    if (!currentMap || !currentMapId) return;
    const oldZones = currentMap.cameraZones || [];
    const zones = [...oldZones];
    const newId = zones.length > 0 ? Math.max(...zones.map(z => z.id)) + 1 : 1;
    const newZone: CameraZone = {
      id: newId,
      name: `Zone${newId}`,
      x, y, width, height,
      zoom: 1.0,
      tilt: 60,
      yaw: 0,
      transitionSpeed: 1.0,
      priority: 0,
      enabled: true,
    };
    zones.push(newZone);
    const historyEntry: CameraZoneHistoryEntry = {
      mapId: currentMapId, type: 'cameraZone',
      oldZones: oldZones, newZones: zones,
      oldSelectedCameraZoneId: selectedCameraZoneId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({
      currentMap: { ...currentMap, cameraZones: zones },
      selectedCameraZoneId: newId,
      undoStack: newStack,
      redoStack: [],
    });
  },

  updateCameraZone: (id: number, updates: Partial<CameraZone>) => {
    const { currentMap, currentMapId, undoStack, selectedCameraZoneId } = get();
    if (!currentMap || !currentMapId || !currentMap.cameraZones) return;
    const oldZones = currentMap.cameraZones;
    const zones = oldZones.map(z => z.id === id ? { ...z, ...updates } : z);
    const historyEntry: CameraZoneHistoryEntry = {
      mapId: currentMapId, type: 'cameraZone',
      oldZones, newZones: zones,
      oldSelectedCameraZoneId: selectedCameraZoneId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({
      currentMap: { ...currentMap, cameraZones: zones },
      undoStack: newStack,
      redoStack: [],
    });
  },

  deleteCameraZone: (id: number) => {
    const { currentMap, currentMapId, undoStack, selectedCameraZoneId } = get();
    if (!currentMap || !currentMapId || !currentMap.cameraZones) return;
    const oldZones = currentMap.cameraZones;
    const zones = oldZones.filter(z => z.id !== id);
    const historyEntry: CameraZoneHistoryEntry = {
      mapId: currentMapId, type: 'cameraZone',
      oldZones, newZones: zones,
      oldSelectedCameraZoneId: selectedCameraZoneId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({
      currentMap: { ...currentMap, cameraZones: zones },
      selectedCameraZoneId: selectedCameraZoneId === id ? null : selectedCameraZoneId,
      undoStack: newStack,
      redoStack: [],
    });
  },

  // UI setters
  setEditMode: (mode: 'map' | 'event' | 'light' | 'object' | 'cameraZone') => {
    const state = get();
    const updates: Partial<EditorState> = { editMode: mode };
    if (mode !== 'map') {
      updates.selectionStart = null;
      updates.selectionEnd = null;
      updates.isPasting = false;
      updates.pastePreviewPos = null;
    }
    if (mode === 'light') {
      updates.lightEditMode = true;
      updates.shadowLight = true;
      if (typeof (window as any).ConfigManager !== 'undefined') {
        (window as any).ConfigManager.shadowLight = true;
      }
      setTimeout(() => get().initEditorLights(), 0);
    } else {
      if (state.editMode === 'light') {
        updates.lightEditMode = false;
        updates.selectedLightId = null;
      }
    }
    if (mode !== 'object') {
      updates.selectedObjectId = null;
    }
    if (mode !== 'event') {
      updates.selectedEventId = null;
      updates.selectedEventIds = [];
      updates.eventSelectionStart = null;
      updates.eventSelectionEnd = null;
      updates.isEventPasting = false;
      updates.eventPastePreviewPos = null;
    }
    if (mode !== 'cameraZone') {
      updates.selectedCameraZoneId = null;
    }
    set(updates);
  },
  setSelectedTool: (tool: string) => {
    const updates: Partial<EditorState> = { selectedTool: tool };
    if (tool !== 'select') {
      updates.selectionStart = null;
      updates.selectionEnd = null;
      updates.isPasting = false;
      updates.pastePreviewPos = null;
    }
    set(updates);
  },
  setSelectedTileId: (id: number) => set({ selectedTileId: id, selectedTiles: null, selectedTilesWidth: 1, selectedTilesHeight: 1 }),
  setSelectedTiles: (tiles: number[][] | null, width: number, height: number) => set({ selectedTiles: tiles, selectedTilesWidth: width, selectedTilesHeight: height }),
  setCurrentLayer: (layer: number) => set({ currentLayer: layer }),
  setCursorTile: (x: number, y: number) => set({ cursorTileX: x, cursorTileY: y }),
  setSelection: (start, end) => set({ selectionStart: start, selectionEnd: end }),
  setIsPasting: (isPasting: boolean) => set({ isPasting }),
  setPastePreviewPos: (pos) => set({ pastePreviewPos: pos }),
  clearSelection: () => set({ selectionStart: null, selectionEnd: null, isPasting: false, pastePreviewPos: null }),
  setSelectedEventId: (id: number | null) => set({ selectedEventId: id }),
});
