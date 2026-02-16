import type { EditorPointLight, EditorAmbientLight, EditorDirectionalLight, EditorPlayerLight, EditorSpotLight, EditorShadowSettings } from '../types/rpgMakerMV';
import { DEFAULT_EDITOR_LIGHTS } from '../types/rpgMakerMV';
import type { EditorState, SliceCreator, LightHistoryEntry } from './types';

/** 조명 변경에 대한 undo 항목 push (헬퍼) */
function pushLightUndo(
  get: () => EditorState,
  set: (partial: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)) => void,
  oldLights: any,
  newLights: any,
) {
  const { currentMapId, undoStack, selectedLightId, selectedLightIds, maxUndo } = get();
  if (!currentMapId) return;
  const entry: LightHistoryEntry = {
    mapId: currentMapId, type: 'light',
    oldLights, newLights,
    oldSelectedLightId: selectedLightId,
    oldSelectedLightIds: selectedLightIds,
  };
  const newStack = [...undoStack, entry];
  if (newStack.length > maxUndo) newStack.shift();
  set({ undoStack: newStack, redoStack: [] });
}

/** 이름의 숫자 포스트픽스를 증가시킨 새 이름 반환 */
function incrementLightName(name: string, lights: { name?: string }[]): string {
  const match = name.match(/^(.*?)(\d+)$/);
  if (!match) return name;
  const prefix = match[1];
  const numStr = match[2];
  const padLen = numStr.length;
  const existingNames = new Set(lights.filter(l => l.name).map(l => l.name!));
  let num = parseInt(numStr, 10);
  let newName: string;
  do {
    num++;
    newName = prefix + String(num).padStart(padLen, '0');
  } while (existingNames.has(newName));
  return newName;
}

export const lightSlice: SliceCreator<Pick<EditorState,
  'lightEditMode' | 'selectedLightId' | 'selectedLightType' |
  'selectedLightIds' | 'lightSelectionStart' | 'lightSelectionEnd' | 'isLightPasting' | 'lightPastePreviewPos' |
  'setLightEditMode' | 'setSelectedLightId' | 'setSelectedLightType' |
  'setSelectedLightIds' | 'setLightSelectionStart' | 'setLightSelectionEnd' | 'setIsLightPasting' | 'setLightPastePreviewPos' | 'clearLightSelection' |
  'initEditorLights' | 'addPointLight' | 'updatePointLight' | 'deletePointLight' |
  'copyLights' | 'pasteLights' | 'deleteLights' | 'moveLights' |
  'updateAmbientLight' | 'updateDirectionalLight' | 'updatePlayerLight' | 'updateSpotLight' | 'updateShadowSettings'
>> = (set, get) => ({
  lightEditMode: false,
  selectedLightId: null,
  selectedLightType: 'point',
  selectedLightIds: [],
  lightSelectionStart: null,
  lightSelectionEnd: null,
  isLightPasting: false,
  lightPastePreviewPos: null,

  setLightEditMode: (enabled: boolean) => set({ lightEditMode: enabled, selectedLightId: null, selectedLightIds: [] }),
  setSelectedLightId: (id: number | null) => set({ selectedLightId: id }),
  setSelectedLightIds: (ids: number[]) => set({ selectedLightIds: ids }),
  setSelectedLightType: (type: 'point' | 'ambient' | 'directional') => set({ selectedLightType: type, selectedLightId: null, selectedLightIds: [] }),
  setLightSelectionStart: (pos) => set({ lightSelectionStart: pos }),
  setLightSelectionEnd: (pos) => set({ lightSelectionEnd: pos }),
  setIsLightPasting: (isPasting: boolean) => set({ isLightPasting: isPasting }),
  setLightPastePreviewPos: (pos) => set({ lightPastePreviewPos: pos }),
  clearLightSelection: () => set({ lightSelectionStart: null, lightSelectionEnd: null, selectedLightIds: [], selectedLightId: null, isLightPasting: false, lightPastePreviewPos: null }),

  initEditorLights: () => {
    const map = get().currentMap;
    if (!map) return;
    if (!map.editorLights) {
      set({ currentMap: { ...map, editorLights: JSON.parse(JSON.stringify(DEFAULT_EDITOR_LIGHTS)) } });
    }
  },

  addPointLight: (x: number, y: number) => {
    const { currentMap: map, currentMapId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    // 같은 위치에 이미 광원이 있으면 생성하지 않음
    if (map.editorLights.points.some(p => p.x === x && p.y === y)) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const points = [...map.editorLights.points];
    const newId = points.length > 0 ? Math.max(...points.map(p => p.id)) + 1 : 1;
    const newLight: EditorPointLight = { id: newId, x, y, z: 30, color: '#ffcc88', intensity: 1.0, distance: 150, decay: 0 };
    points.push(newLight);
    const newLights = { ...map.editorLights, points };
    set({ currentMap: { ...map, editorLights: newLights }, selectedLightId: newId, selectedLightIds: [newId] });
    pushLightUndo(get, set, oldLights, JSON.parse(JSON.stringify(newLights)));
  },

  updatePointLight: (id: number, updates: Partial<EditorPointLight>) => {
    const { currentMap: map, currentMapId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const points = map.editorLights.points.map(p => p.id === id ? { ...p, ...updates } : p);
    const newLights = { ...map.editorLights, points };
    set({ currentMap: { ...map, editorLights: newLights } });
    pushLightUndo(get, set, oldLights, JSON.parse(JSON.stringify(newLights)));
  },

  deletePointLight: (id: number) => {
    const { currentMap: map, currentMapId, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const points = map.editorLights.points.filter(p => p.id !== id);
    const newLights = { ...map.editorLights, points };
    set({
      currentMap: { ...map, editorLights: newLights },
      selectedLightId: selectedLightId === id ? null : selectedLightId,
      selectedLightIds: get().selectedLightIds.filter(lid => lid !== id),
    });
    pushLightUndo(get, set, oldLights, JSON.parse(JSON.stringify(newLights)));
  },

  copyLights: (lightIds: number[]) => {
    const map = get().currentMap;
    if (!map || !map.editorLights || lightIds.length === 0) return;
    const lights = lightIds
      .map(id => map.editorLights!.points.find(p => p.id === id))
      .filter((p): p is EditorPointLight => !!p);
    if (lights.length === 0) return;
    set({ clipboard: { type: 'lights', lights: JSON.parse(JSON.stringify(lights)) } });
  },

  pasteLights: (x: number, y: number) => {
    const { clipboard, currentMap: map } = get();
    if (!map || !map.editorLights || !clipboard || clipboard.type !== 'lights' || !clipboard.lights) return;
    const srcLights = clipboard.lights as EditorPointLight[];
    if (srcLights.length === 0) return;
    const minX = Math.min(...srcLights.map(l => l.x));
    const minY = Math.min(...srcLights.map(l => l.y));
    // 기존 광원 위치 + 붙여넣기 광원 간 겹침 방지
    const occupied = new Set(map.editorLights.points.map(p => `${p.x},${p.y}`));
    for (const light of srcLights) {
      const nx = x + (light.x - minX);
      const ny = y + (light.y - minY);
      if (occupied.has(`${nx},${ny}`)) return;
    }
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const points = [...map.editorLights.points];
    let maxId = points.length > 0 ? Math.max(...points.map(p => p.id)) : 0;
    const newIds: number[] = [];
    for (const light of srcLights) {
      const newId = ++maxId;
      const nx = x + (light.x - minX);
      const ny = y + (light.y - minY);
      const newLight: EditorPointLight = { ...light, id: newId, x: nx, y: ny };
      points.push(newLight);
      newIds.push(newId);
    }
    const newLights = { ...map.editorLights, points };
    set({ currentMap: { ...map, editorLights: newLights }, selectedLightIds: newIds, selectedLightId: newIds[0] ?? null });
    pushLightUndo(get, set, oldLights, JSON.parse(JSON.stringify(newLights)));
  },

  deleteLights: (lightIds: number[]) => {
    const { currentMap: map } = get();
    if (!map || !map.editorLights || lightIds.length === 0) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const idSet = new Set(lightIds);
    const points = map.editorLights.points.filter(p => !idSet.has(p.id));
    const newLights = { ...map.editorLights, points };
    set({ currentMap: { ...map, editorLights: newLights }, selectedLightIds: [], selectedLightId: null });
    pushLightUndo(get, set, oldLights, JSON.parse(JSON.stringify(newLights)));
  },

  moveLights: (lightIds: number[], dx: number, dy: number) => {
    const { currentMap: map } = get();
    if (!map || !map.editorLights || lightIds.length === 0) return;
    if (dx === 0 && dy === 0) return;
    const idSet = new Set(lightIds);
    // 이동 후 위치가 다른 (이동하지 않는) 광원과 겹치는지 확인
    const staticPositions = new Set(
      map.editorLights.points.filter(p => !idSet.has(p.id)).map(p => `${p.x},${p.y}`)
    );
    const movedPositions = new Set<string>();
    for (const p of map.editorLights.points) {
      if (!idSet.has(p.id)) continue;
      const nx = p.x + dx;
      const ny = p.y + dy;
      const key = `${nx},${ny}`;
      if (staticPositions.has(key) || movedPositions.has(key)) return;
      movedPositions.add(key);
    }
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const points = map.editorLights.points.map(p => {
      if (idSet.has(p.id)) {
        return { ...p, x: p.x + dx, y: p.y + dy };
      }
      return p;
    });
    const newLights = { ...map.editorLights, points };
    set({ currentMap: { ...map, editorLights: newLights } });
    pushLightUndo(get, set, oldLights, JSON.parse(JSON.stringify(newLights)));
  },

  updateAmbientLight: (updates: Partial<EditorAmbientLight>) => {
    const { currentMap: map, currentMapId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const newLights = { ...map.editorLights, ambient: { ...map.editorLights.ambient, ...updates } };
    set({ currentMap: { ...map, editorLights: newLights } });
    pushLightUndo(get, set, oldLights, JSON.parse(JSON.stringify(newLights)));
  },

  updateDirectionalLight: (updates: Partial<EditorDirectionalLight>) => {
    const { currentMap: map, currentMapId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const newLights = { ...map.editorLights, directional: { ...map.editorLights.directional, ...updates } };
    set({ currentMap: { ...map, editorLights: newLights } });
    pushLightUndo(get, set, oldLights, JSON.parse(JSON.stringify(newLights)));
  },

  updatePlayerLight: (updates: Partial<EditorPlayerLight>) => {
    const { currentMap: map, currentMapId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const cur = map.editorLights.playerLight ?? { color: '#a25f06', intensity: 0.8, distance: 200, z: 40 };
    const newLights = { ...map.editorLights, playerLight: { ...cur, ...updates } };
    set({ currentMap: { ...map, editorLights: newLights } });
    pushLightUndo(get, set, oldLights, JSON.parse(JSON.stringify(newLights)));
  },

  updateSpotLight: (updates: Partial<EditorSpotLight>) => {
    const { currentMap: map, currentMapId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const cur = map.editorLights.spotLight ?? { enabled: true, color: '#ffeedd', intensity: 0.8, distance: 250, angle: 0.60, penumbra: 0.9, z: 120, shadowMapSize: 2048, targetDistance: 70 };
    const newLights = { ...map.editorLights, spotLight: { ...cur, ...updates } };
    set({ currentMap: { ...map, editorLights: newLights } });
    pushLightUndo(get, set, oldLights, JSON.parse(JSON.stringify(newLights)));
  },

  updateShadowSettings: (updates: Partial<EditorShadowSettings>) => {
    const { currentMap: map, currentMapId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const cur = map.editorLights.shadow ?? { opacity: 0.4, color: '#000000', offsetScale: 0.6 };
    const newLights = { ...map.editorLights, shadow: { ...cur, ...updates } };
    set({ currentMap: { ...map, editorLights: newLights } });
    pushLightUndo(get, set, oldLights, JSON.parse(JSON.stringify(newLights)));
  },
});
