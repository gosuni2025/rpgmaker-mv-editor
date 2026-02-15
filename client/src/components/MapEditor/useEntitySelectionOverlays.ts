import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';

/**
 * Helper: dispose all meshes in a global array and clear it
 */
function disposeMeshes(scene: any, globalKey: string) {
  if (!(window as any)[globalKey]) (window as any)[globalKey] = [];
  const existing = (window as any)[globalKey] as any[];
  for (const m of existing) {
    scene.remove(m);
    m.geometry?.dispose();
    m.material?.dispose();
  }
  existing.length = 0;
  return existing;
}

/**
 * Helper: trigger a render frame
 */
function triggerRender(
  renderRequestedRef: React.MutableRefObject<boolean>,
  rendererObjRef: React.MutableRefObject<any>,
  stageRef: React.MutableRefObject<any>,
) {
  if (!renderRequestedRef.current) {
    renderRequestedRef.current = true;
    requestAnimationFrame(() => {
      renderRequestedRef.current = false;
      if (!rendererObjRef.current || !stageRef.current) return;
      const strategy = (window as any).RendererStrategy?.getStrategy();
      if (strategy) strategy.render(rendererObjRef.current, stageRef.current);
    });
  }
}

/**
 * Helper: create entity highlight (fill + border) at tile position
 */
function createHighlightMesh(
  THREE: any, scene: any, meshes: any[],
  cx: number, cy: number, w: number, h: number,
  fillColor: number, strokeColor: number,
  fillZ: number, lineZ: number,
  fillOrder: number, lineOrder: number,
) {
  const geom = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({
    color: fillColor, opacity: 0.3, transparent: true,
    depthTest: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(cx, cy, fillZ);
  mesh.renderOrder = fillOrder;
  mesh.frustumCulled = false;
  mesh.userData.editorGrid = true;
  scene.add(mesh);
  meshes.push(mesh);

  const hw = w / 2, hh = h / 2;
  const pts = [
    new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
    new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
    new THREE.Vector3(-hw, -hh, 0),
  ];
  const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
  const lineMat = new THREE.LineBasicMaterial({
    color: strokeColor, depthTest: false, transparent: true, opacity: 1.0,
  });
  const line = new THREE.Line(lineGeom, lineMat);
  line.position.set(cx, cy, lineZ);
  line.renderOrder = lineOrder;
  line.frustumCulled = false;
  line.userData.editorGrid = true;
  scene.add(line);
  meshes.push(line);
}

/**
 * Helper: create drag selection area (dashed rect)
 */
function createDragSelectionArea(
  THREE: any, scene: any, meshes: any[],
  start: { x: number; y: number }, end: { x: number; y: number },
  color: number,
) {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);

  const rw = (maxX - minX + 1) * TILE_SIZE_PX;
  const rh = (maxY - minY + 1) * TILE_SIZE_PX;
  const cx = minX * TILE_SIZE_PX + rw / 2;
  const cy = minY * TILE_SIZE_PX + rh / 2;

  const geom = new THREE.PlaneGeometry(rw, rh);
  const mat = new THREE.MeshBasicMaterial({
    color, opacity: 0.15, transparent: true,
    depthTest: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(cx, cy, 6.5);
  mesh.renderOrder = 10004;
  mesh.frustumCulled = false;
  mesh.userData.editorGrid = true;
  scene.add(mesh);
  meshes.push(mesh);

  const hw = rw / 2, hh = rh / 2;
  const pts = [
    new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
    new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
    new THREE.Vector3(-hw, -hh, 0),
  ];
  const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
  const lineMat = new THREE.LineDashedMaterial({
    color, depthTest: false, transparent: true,
    opacity: 1.0, dashSize: 6, gapSize: 4,
  });
  const line = new THREE.Line(lineGeom, lineMat);
  line.computeLineDistances();
  line.position.set(cx, cy, 6.8);
  line.renderOrder = 10005;
  line.frustumCulled = false;
  line.userData.editorGrid = true;
  scene.add(line);
  meshes.push(line);
}

/**
 * Helper: create paste preview boxes
 */
function createPastePreview(
  THREE: any, scene: any, meshes: any[],
  items: { x: number; y: number; width?: number; height?: number }[],
  fillColor: number, strokeColor: number,
  isObject?: boolean,
) {
  for (const item of items) {
    const w = (item.width || 1) * TILE_SIZE_PX;
    const h = (item.height || 1) * TILE_SIZE_PX;
    const cx = item.x * TILE_SIZE_PX + w / 2;
    const cy = isObject
      ? (item.y - (item.height || 1) + 1) * TILE_SIZE_PX + h / 2
      : item.y * TILE_SIZE_PX + h / 2;

    const geom = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      color: fillColor, opacity: 0.4, transparent: true,
      depthTest: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(cx, cy, 6);
    mesh.renderOrder = 10000;
    mesh.frustumCulled = false;
    mesh.userData.editorGrid = true;
    scene.add(mesh);
    meshes.push(mesh);

    const hw = w / 2, hh = h / 2;
    const pts = [
      new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
      new THREE.Vector3(-hw, -hh, 0),
    ];
    const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({
      color: strokeColor, depthTest: false, transparent: true, opacity: 1.0,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    line.position.set(cx, cy, 6.5);
    line.renderOrder = 10001;
    line.frustumCulled = false;
    line.userData.editorGrid = true;
    scene.add(line);
    meshes.push(line);
  }
}

interface OverlayRefs {
  rendererObjRef: React.MutableRefObject<any>;
  stageRef: React.MutableRefObject<any>;
  renderRequestedRef: React.MutableRefObject<boolean>;
}

/**
 * Event selection overlays (선택된 이벤트 하이라이트 + 드래그 선택 영역 + 붙여넣기 프리뷰)
 */
export function useEventSelectionOverlays(refs: OverlayRefs, rendererReady: number) {
  const editMode = useEditorStore((s) => s.editMode);
  const selectedEventIds = useEditorStore((s) => s.selectedEventIds);
  const eventSelectionStart = useEditorStore((s) => s.eventSelectionStart);
  const eventSelectionEnd = useEditorStore((s) => s.eventSelectionEnd);
  const isEventPasting = useEditorStore((s) => s.isEventPasting);
  const eventPastePreviewPos = useEditorStore((s) => s.eventPastePreviewPos);
  const clipboard = useEditorStore((s) => s.clipboard);
  const currentMap = useEditorStore((s) => s.currentMap);

  React.useEffect(() => {
    const rObj = refs.rendererObjRef.current;
    if (!rObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    const meshes = disposeMeshes(rObj.scene, '_editorEventSelMeshes');

    // 1. 선택된 이벤트 하이라이트
    if (editMode === 'event' && selectedEventIds.length > 0 && currentMap?.events) {
      for (const evId of selectedEventIds) {
        const ev = currentMap.events.find(e => e && e.id === evId);
        if (!ev) continue;
        const cx = ev.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const cy = ev.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        createHighlightMesh(THREE, rObj.scene, meshes, cx, cy, TILE_SIZE_PX, TILE_SIZE_PX, 0x4488ff, 0x4488ff, 5.5, 5.8, 9998, 9999);
      }
    }

    // 2. 드래그 선택 영역
    if (editMode === 'event' && eventSelectionStart && eventSelectionEnd) {
      createDragSelectionArea(THREE, rObj.scene, meshes, eventSelectionStart, eventSelectionEnd, 0x00bfff);
    }

    // 3. 이벤트 붙여넣기 프리뷰
    if (editMode === 'event' && isEventPasting && eventPastePreviewPos) {
      const cb = clipboard;
      let evts: any[] | undefined;
      if (cb?.type === 'events' && cb.events) evts = cb.events as any[];
      else if (cb?.type === 'event' && cb.event) evts = [cb.event];
      if (evts && evts.length > 0) {
        const minX = Math.min(...evts.map((e: any) => e.x));
        const minY = Math.min(...evts.map((e: any) => e.y));
        const previewItems = evts.map(evt => ({
          x: eventPastePreviewPos.x + (evt.x - minX),
          y: eventPastePreviewPos.y + (evt.y - minY),
        }));
        createPastePreview(THREE, rObj.scene, meshes, previewItems, 0x00b450, 0x00ff00);
      }
    }

    triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
  }, [editMode, selectedEventIds, eventSelectionStart, eventSelectionEnd, isEventPasting, eventPastePreviewPos, clipboard, currentMap?.events, rendererReady]);
}

/**
 * Light selection overlays (선택된 라이트 하이라이트 + 드래그 선택 영역 + 붙여넣기 프리뷰)
 */
export function useLightSelectionOverlays(refs: OverlayRefs, rendererReady: number) {
  const lightEditMode = useEditorStore((s) => s.lightEditMode);
  const selectedLightIds = useEditorStore((s) => s.selectedLightIds);
  const lightSelectionStart = useEditorStore((s) => s.lightSelectionStart);
  const lightSelectionEnd = useEditorStore((s) => s.lightSelectionEnd);
  const isLightPasting = useEditorStore((s) => s.isLightPasting);
  const lightPastePreviewPos = useEditorStore((s) => s.lightPastePreviewPos);
  const clipboard = useEditorStore((s) => s.clipboard);
  const currentMap = useEditorStore((s) => s.currentMap);

  React.useEffect(() => {
    const rObj = refs.rendererObjRef.current;
    if (!rObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    const meshes = disposeMeshes(rObj.scene, '_editorLightSelMeshes');

    // 1. 선택된 라이트 하이라이트
    if (lightEditMode && selectedLightIds.length > 0 && currentMap?.editorLights?.points) {
      for (const lid of selectedLightIds) {
        const light = currentMap.editorLights.points.find(p => p.id === lid);
        if (!light) continue;
        const cx = light.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const cy = light.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        createHighlightMesh(THREE, rObj.scene, meshes, cx, cy, TILE_SIZE_PX, TILE_SIZE_PX, 0xffcc44, 0xffcc44, 5.5, 5.8, 9998, 9999);
      }
    }

    // 2. 드래그 선택 영역
    if (lightEditMode && lightSelectionStart && lightSelectionEnd) {
      createDragSelectionArea(THREE, rObj.scene, meshes, lightSelectionStart, lightSelectionEnd, 0xffaa00);
    }

    // 3. 라이트 붙여넣기 프리뷰
    if (lightEditMode && isLightPasting && lightPastePreviewPos && clipboard?.type === 'lights' && clipboard.lights) {
      const srcLights = clipboard.lights as any[];
      if (srcLights.length > 0) {
        const minX = Math.min(...srcLights.map((l: any) => l.x));
        const minY = Math.min(...srcLights.map((l: any) => l.y));
        const previewItems = srcLights.map(l => ({
          x: lightPastePreviewPos.x + (l.x - minX),
          y: lightPastePreviewPos.y + (l.y - minY),
        }));
        createPastePreview(THREE, rObj.scene, meshes, previewItems, 0xffcc88, 0xffcc88);
      }
    }

    triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
  }, [lightEditMode, selectedLightIds, lightSelectionStart, lightSelectionEnd, isLightPasting, lightPastePreviewPos, clipboard, currentMap?.editorLights?.points, rendererReady]);
}

/**
 * Object selection overlays (선택된 오브젝트 하이라이트 + 드래그 선택 영역 + 붙여넣기 프리뷰)
 */
export function useObjectSelectionOverlays(refs: OverlayRefs, rendererReady: number) {
  const editMode = useEditorStore((s) => s.editMode);
  const selectedObjectIds = useEditorStore((s) => s.selectedObjectIds);
  const objectSelectionStart = useEditorStore((s) => s.objectSelectionStart);
  const objectSelectionEnd = useEditorStore((s) => s.objectSelectionEnd);
  const isObjectPasting = useEditorStore((s) => s.isObjectPasting);
  const objectPastePreviewPos = useEditorStore((s) => s.objectPastePreviewPos);
  const clipboard = useEditorStore((s) => s.clipboard);
  const currentMap = useEditorStore((s) => s.currentMap);
  const objectPaintTiles = useEditorStore((s) => s.objectPaintTiles);

  React.useEffect(() => {
    const rObj = refs.rendererObjRef.current;
    if (!rObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    const meshes = disposeMeshes(rObj.scene, '_editorObjSelMeshes');
    const isObjMode = editMode === 'object';
    const selectedSet = new Set(selectedObjectIds);

    // 0. 모든 오브젝트 영역 표시 (선택되지 않은 것 = 어두운 색, 선택된 것 = 밝은 색)
    if (isObjMode && currentMap?.objects) {
      for (const obj of currentMap.objects as any[]) {
        if (!obj) continue;
        const isSelected = selectedSet.has(obj.id);
        const fillColor = isSelected ? 0x44ff88 : 0x6688cc;
        const strokeColor = isSelected ? 0x44ff88 : 0x6688cc;
        const ow = obj.width || 1;
        const oh = obj.height || 1;
        const tileIds = obj.tileIds;
        if (tileIds && tileIds.length > 0) {
          for (let row = 0; row < oh; row++) {
            for (let col = 0; col < ow; col++) {
              const cell = tileIds[row]?.[col];
              const hasContent = Array.isArray(cell)
                ? cell.some((t: number) => t !== 0)
                : (cell !== 0 && cell != null);
              if (hasContent) {
                const tx = obj.x + col;
                const ty = (obj.y - oh + 1) + row;
                const cx = tx * TILE_SIZE_PX + TILE_SIZE_PX / 2;
                const cy = ty * TILE_SIZE_PX + TILE_SIZE_PX / 2;
                createHighlightMesh(THREE, rObj.scene, meshes, cx, cy, TILE_SIZE_PX, TILE_SIZE_PX, fillColor, strokeColor, 5.5, 5.8, 9998, 9999);
              }
            }
          }
        } else {
          const rw = ow * TILE_SIZE_PX;
          const rh = oh * TILE_SIZE_PX;
          const cx = obj.x * TILE_SIZE_PX + rw / 2;
          const cy = (obj.y - oh + 1) * TILE_SIZE_PX + rh / 2;
          createHighlightMesh(THREE, rObj.scene, meshes, cx, cy, rw, rh, fillColor, strokeColor, 5.5, 5.8, 9998, 9999);
        }
      }
    }

    // 2. 드래그 선택 영역
    if (isObjMode && objectSelectionStart && objectSelectionEnd) {
      createDragSelectionArea(THREE, rObj.scene, meshes, objectSelectionStart, objectSelectionEnd, 0x00ff66);
    }

    // 3. 오브젝트 붙여넣기 프리뷰
    if (isObjMode && isObjectPasting && objectPastePreviewPos && clipboard?.type === 'objects' && clipboard.objects) {
      const srcObjs = clipboard.objects as any[];
      if (srcObjs.length > 0) {
        const minX = Math.min(...srcObjs.map((o: any) => o.x));
        const minY = Math.min(...srcObjs.map((o: any) => o.y));
        const previewItems = srcObjs.map(obj => ({
          x: objectPastePreviewPos.x + (obj.x - minX),
          y: objectPastePreviewPos.y + (obj.y - minY),
          width: obj.width || 1,
          height: obj.height || 1,
        }));
        createPastePreview(THREE, rObj.scene, meshes, previewItems, 0x00ff66, 0x00ff66, true);
      }
    }

    // 4. 오브젝트 펜 칠하기 프리뷰
    if (isObjMode && objectPaintTiles && objectPaintTiles.size > 0) {
      for (const key of objectPaintTiles) {
        const [sx, sy] = key.split(',');
        const tx = parseInt(sx), ty = parseInt(sy);
        const cx = tx * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const cy = ty * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        createHighlightMesh(THREE, rObj.scene, meshes, cx, cy, TILE_SIZE_PX, TILE_SIZE_PX, 0x44ff88, 0x44ff88, 6.0, 6.3, 10002, 10003);
      }
    }

    triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
  }, [editMode, selectedObjectIds, objectSelectionStart, objectSelectionEnd, isObjectPasting, objectPastePreviewPos, clipboard, currentMap?.objects, objectPaintTiles, rendererReady]);
}
