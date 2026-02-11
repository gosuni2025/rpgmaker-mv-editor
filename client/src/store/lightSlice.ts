import type { EditorPointLight, EditorAmbientLight, EditorDirectionalLight, EditorPlayerLight, EditorSpotLight, EditorShadowSettings } from '../types/rpgMakerMV';
import { DEFAULT_EDITOR_LIGHTS } from '../types/rpgMakerMV';
import type { EditorState, SliceCreator, LightHistoryEntry } from './types';

export const lightSlice: SliceCreator<Pick<EditorState,
  'lightEditMode' | 'selectedLightId' | 'selectedLightType' |
  'setLightEditMode' | 'setSelectedLightId' | 'setSelectedLightType' |
  'initEditorLights' | 'addPointLight' | 'updatePointLight' | 'deletePointLight' |
  'updateAmbientLight' | 'updateDirectionalLight' | 'updatePlayerLight' | 'updateSpotLight' | 'updateShadowSettings'
>> = (set, get) => ({
  lightEditMode: false,
  selectedLightId: null,
  selectedLightType: 'point',

  setLightEditMode: (enabled: boolean) => set({ lightEditMode: enabled, selectedLightId: null }),
  setSelectedLightId: (id: number | null) => set({ selectedLightId: id }),
  setSelectedLightType: (type: 'point' | 'ambient' | 'directional') => set({ selectedLightType: type, selectedLightId: null }),

  initEditorLights: () => {
    const map = get().currentMap;
    if (!map) return;
    if (!map.editorLights) {
      set({ currentMap: { ...map, editorLights: JSON.parse(JSON.stringify(DEFAULT_EDITOR_LIGHTS)) } });
    }
  },

  addPointLight: (x: number, y: number) => {
    const { currentMap: map, currentMapId, undoStack, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const points = [...map.editorLights.points];
    const newId = points.length > 0 ? Math.max(...points.map(p => p.id)) + 1 : 1;
    const newLight: EditorPointLight = { id: newId, x, y, z: 30, color: '#ffcc88', intensity: 1.0, distance: 150, decay: 0 };
    points.push(newLight);
    const newLights = { ...map.editorLights, points };
    const historyEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light', oldLights, newLights: JSON.parse(JSON.stringify(newLights)),
      oldSelectedLightId: selectedLightId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({
      currentMap: { ...map, editorLights: newLights },
      selectedLightId: newId,
      undoStack: newStack,
      redoStack: [],
    });
  },

  updatePointLight: (id: number, updates: Partial<EditorPointLight>) => {
    const { currentMap: map, currentMapId, undoStack, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const points = map.editorLights.points.map(p => p.id === id ? { ...p, ...updates } : p);
    const newLights = { ...map.editorLights, points };
    const historyEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light', oldLights, newLights: JSON.parse(JSON.stringify(newLights)),
      oldSelectedLightId: selectedLightId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({
      currentMap: { ...map, editorLights: newLights },
      undoStack: newStack,
      redoStack: [],
    });
  },

  deletePointLight: (id: number) => {
    const { currentMap: map, currentMapId, undoStack, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const points = map.editorLights.points.filter(p => p.id !== id);
    const newLights = { ...map.editorLights, points };
    const historyEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light', oldLights, newLights: JSON.parse(JSON.stringify(newLights)),
      oldSelectedLightId: selectedLightId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({
      currentMap: { ...map, editorLights: newLights },
      selectedLightId: selectedLightId === id ? null : selectedLightId,
      undoStack: newStack,
      redoStack: [],
    });
  },

  updateAmbientLight: (updates: Partial<EditorAmbientLight>) => {
    const { currentMap: map, currentMapId, undoStack, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const newLights = { ...map.editorLights, ambient: { ...map.editorLights.ambient, ...updates } };
    const historyEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light', oldLights, newLights: JSON.parse(JSON.stringify(newLights)),
      oldSelectedLightId: selectedLightId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({
      currentMap: { ...map, editorLights: newLights },
      undoStack: newStack,
      redoStack: [],
    });
  },

  updateDirectionalLight: (updates: Partial<EditorDirectionalLight>) => {
    const { currentMap: map, currentMapId, undoStack, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const newLights = { ...map.editorLights, directional: { ...map.editorLights.directional, ...updates } };
    const historyEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light', oldLights, newLights: JSON.parse(JSON.stringify(newLights)),
      oldSelectedLightId: selectedLightId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({
      currentMap: { ...map, editorLights: newLights },
      undoStack: newStack,
      redoStack: [],
    });
  },

  updatePlayerLight: (updates: Partial<EditorPlayerLight>) => {
    const { currentMap: map, currentMapId, undoStack, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const cur = map.editorLights.playerLight ?? { color: '#a25f06', intensity: 0.8, distance: 200, z: 40 };
    const newLights = { ...map.editorLights, playerLight: { ...cur, ...updates } };
    const historyEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light', oldLights, newLights: JSON.parse(JSON.stringify(newLights)),
      oldSelectedLightId: selectedLightId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({ currentMap: { ...map, editorLights: newLights }, undoStack: newStack, redoStack: [] });
  },

  updateSpotLight: (updates: Partial<EditorSpotLight>) => {
    const { currentMap: map, currentMapId, undoStack, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const cur = map.editorLights.spotLight ?? { enabled: true, color: '#ffeedd', intensity: 0.8, distance: 250, angle: 0.60, penumbra: 0.9, z: 120, shadowMapSize: 2048, targetDistance: 70 };
    const newLights = { ...map.editorLights, spotLight: { ...cur, ...updates } };
    const historyEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light', oldLights, newLights: JSON.parse(JSON.stringify(newLights)),
      oldSelectedLightId: selectedLightId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({ currentMap: { ...map, editorLights: newLights }, undoStack: newStack, redoStack: [] });
  },

  updateShadowSettings: (updates: Partial<EditorShadowSettings>) => {
    const { currentMap: map, currentMapId, undoStack, selectedLightId } = get();
    if (!map || !map.editorLights || !currentMapId) return;
    const oldLights = JSON.parse(JSON.stringify(map.editorLights));
    const cur = map.editorLights.shadow ?? { opacity: 0.4, color: '#000000', offsetScale: 0.6 };
    const newLights = { ...map.editorLights, shadow: { ...cur, ...updates } };
    const historyEntry: LightHistoryEntry = {
      mapId: currentMapId, type: 'light', oldLights, newLights: JSON.parse(JSON.stringify(newLights)),
      oldSelectedLightId: selectedLightId,
    };
    const newStack = [...undoStack, historyEntry];
    if (newStack.length > get().maxUndo) newStack.shift();
    set({ currentMap: { ...map, editorLights: newLights }, undoStack: newStack, redoStack: [] });
  },
});
