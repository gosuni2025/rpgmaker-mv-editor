import React, { useMemo } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import type { DragPreviewInfo } from './useThreeRenderer';

interface SyncRefs {
  rendererObjRef: React.MutableRefObject<any>;
  stageRef: React.MutableRefObject<any>;
  renderRequestedRef: React.MutableRefObject<boolean>;
  startPosMeshesRef: React.MutableRefObject<any[]>;
  testStartPosMeshesRef: React.MutableRefObject<any[]>;
  vehicleStartPosMeshesRef: React.MutableRefObject<any[]>;
}

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
 * Build drag preview items from mouse handler state
 */
export function useDragPreviews(
  eventMultiDragDelta: { dx: number; dy: number } | null,
  lightMultiDragDelta: { dx: number; dy: number } | null,
  objectMultiDragDelta: { dx: number; dy: number } | null,
  lightDragPreview: { x: number; y: number } | null,
  objectDragPreview: { x: number; y: number } | null,
  isDraggingLight: React.MutableRefObject<boolean>,
  isDraggingObject: React.MutableRefObject<boolean>,
  draggedObjectId: React.MutableRefObject<number | null>,
): DragPreviewInfo[] {
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectedEventIds = useEditorStore((s) => s.selectedEventIds);
  const selectedLightIds = useEditorStore((s) => s.selectedLightIds);
  const selectedObjectIds = useEditorStore((s) => s.selectedObjectIds);

  return useMemo<DragPreviewInfo[]>(() => {
    const result: DragPreviewInfo[] = [];
    if (eventMultiDragDelta && currentMap?.events && selectedEventIds.length > 0) {
      for (const evId of selectedEventIds) {
        const ev = currentMap.events.find(e => e && e.id === evId);
        if (ev) {
          result.push({ type: 'event', x: ev.x + eventMultiDragDelta.dx, y: ev.y + eventMultiDragDelta.dy });
        }
      }
    }
    if (lightMultiDragDelta && currentMap?.editorLights?.points && selectedLightIds.length > 0) {
      for (const lid of selectedLightIds) {
        const light = currentMap.editorLights.points.find(p => p.id === lid);
        if (light) {
          result.push({ type: 'light', x: light.x + lightMultiDragDelta.dx, y: light.y + lightMultiDragDelta.dy });
        }
      }
    } else if (lightDragPreview && isDraggingLight.current) {
      result.push({ type: 'light', x: lightDragPreview.x, y: lightDragPreview.y });
    }
    if (objectMultiDragDelta && currentMap?.objects && selectedObjectIds.length > 0) {
      for (const oid of selectedObjectIds) {
        const obj = (currentMap.objects as any[]).find(o => o.id === oid);
        if (obj) {
          result.push({ type: 'object', x: obj.x + objectMultiDragDelta.dx, y: obj.y + objectMultiDragDelta.dy, width: obj.width, height: obj.height });
        }
      }
    } else if (objectDragPreview && isDraggingObject.current && draggedObjectId.current != null) {
      const obj = currentMap?.objects?.find((o: any) => o.id === draggedObjectId.current);
      if (obj) {
        result.push({ type: 'object', x: objectDragPreview.x, y: objectDragPreview.y, width: obj.width, height: obj.height });
      }
    }
    return result;
  }, [eventMultiDragDelta, selectedEventIds, lightMultiDragDelta, selectedLightIds, objectMultiDragDelta, selectedObjectIds, lightDragPreview, objectDragPreview, currentMap?.objects, currentMap?.events, currentMap?.editorLights?.points]);
}

/**
 * Sync drag preview meshes to Three.js scene
 */
export function useDragPreviewMeshSync(
  refs: SyncRefs,
  dragPreviews: DragPreviewInfo[],
  rendererReady: number,
) {
  React.useEffect(() => {
    const rObj = refs.rendererObjRef.current;
    if (!rObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    const scene = rObj.scene;
    if (!(window as any)._editorDragMeshes) (window as any)._editorDragMeshes = [];
    const existing = (window as any)._editorDragMeshes as any[];
    for (const m of existing) {
      scene.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
    existing.length = 0;

    for (const dp of dragPreviews) {
      let fillColor: number, strokeColor: number;
      let dpW = 1, dpH = 1;
      if (dp.type === 'event') {
        fillColor = 0x00b450; strokeColor = 0x00ff00;
      } else if (dp.type === 'light') {
        fillColor = 0xffcc88; strokeColor = 0xffcc88;
      } else {
        fillColor = 0x00ff66; strokeColor = 0x00ff66;
        dpW = dp.width || 1;
        dpH = dp.height || 1;
      }

      const geom = new THREE.PlaneGeometry(TILE_SIZE_PX * dpW, TILE_SIZE_PX * dpH);
      const mat = new THREE.MeshBasicMaterial({
        color: fillColor, opacity: 0.4, transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geom, mat);
      const cx = dp.x * TILE_SIZE_PX + TILE_SIZE_PX * dpW / 2;
      const cy = dp.type === 'object'
        ? (dp.y - dpH + 1) * TILE_SIZE_PX + TILE_SIZE_PX * dpH / 2
        : dp.y * TILE_SIZE_PX + TILE_SIZE_PX * dpH / 2;
      mesh.position.set(cx, cy, 6);
      mesh.renderOrder = 10000;
      mesh.frustumCulled = false;
      mesh.userData.editorGrid = true;
      scene.add(mesh);
      existing.push(mesh);

      const hw = TILE_SIZE_PX * dpW / 2;
      const hh = TILE_SIZE_PX * dpH / 2;
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
      existing.push(line);
    }

    triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
  }, [dragPreviews, rendererReady]);
}

/**
 * Camera zone mesh cleanup (editMode 전환 시)
 */
export function useCameraZoneMeshCleanup(
  refs: SyncRefs,
  rendererReady: number,
) {
  const editMode = useEditorStore((s) => s.editMode);

  React.useEffect(() => {
    const rObj = refs.rendererObjRef.current;
    if (!rObj) return;

    if (!(window as any)._editorCameraZoneMeshes) (window as any)._editorCameraZoneMeshes = [];
    const existing = (window as any)._editorCameraZoneMeshes as any[];
    for (const m of existing) {
      rObj.scene.remove(m);
      m.geometry?.dispose();
      if (m.material?.map) m.material.map.dispose();
      m.material?.dispose();
    }
    existing.length = 0;

    triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
  }, [editMode, rendererReady]);
}

/**
 * Player start position drag preview (시작 위치 드래그 시 위치 이동)
 */
export function usePlayerStartDragPreview(
  refs: SyncRefs,
  playerStartDragPos: { x: number; y: number } | null,
  rendererReady: number,
) {
  const systemData = useEditorStore((s) => s.systemData);
  const currentMapId = useEditorStore((s) => s.currentMapId);

  React.useEffect(() => {
    const meshes = refs.startPosMeshesRef.current;
    if (!meshes || meshes.length === 0 || !systemData || currentMapId !== systemData.startMapId) return;
    const origX = systemData.startX;
    const origY = systemData.startY;
    if (playerStartDragPos) {
      const dx = (playerStartDragPos.x - origX) * TILE_SIZE_PX;
      const dy = (playerStartDragPos.y - origY) * TILE_SIZE_PX;
      for (const m of meshes) {
        if (m._origPos === undefined) {
          m._origPos = { x: m.position.x, y: m.position.y };
        }
        m.position.x = m._origPos.x + dx;
        m.position.y = m._origPos.y + dy;
      }
    } else {
      for (const m of meshes) {
        if (m._origPos !== undefined) {
          m.position.x = m._origPos.x;
          m.position.y = m._origPos.y;
          delete m._origPos;
        }
      }
    }
    triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
  }, [playerStartDragPos, systemData, currentMapId, rendererReady]);
}

/**
 * Test start position drag preview (테스트 시작 위치 드래그 시 위치 이동)
 */
export function useTestStartDragPreview(
  refs: SyncRefs,
  testStartDragPos: { x: number; y: number } | null,
  rendererReady: number,
) {
  const testStartPosition = useEditorStore((s) => s.currentMap?.testStartPosition ?? null);

  React.useEffect(() => {
    const meshes = refs.testStartPosMeshesRef.current;
    if (!meshes || meshes.length === 0 || !testStartPosition) return;
    const origX = testStartPosition.x;
    const origY = testStartPosition.y;
    if (testStartDragPos) {
      const dx = (testStartDragPos.x - origX) * TILE_SIZE_PX;
      const dy = (testStartDragPos.y - origY) * TILE_SIZE_PX;
      for (const m of meshes) {
        if (m._origPos === undefined) {
          m._origPos = { x: m.position.x, y: m.position.y };
        }
        m.position.x = m._origPos.x + dx;
        m.position.y = m._origPos.y + dy;
      }
    } else {
      for (const m of meshes) {
        if (m._origPos !== undefined) {
          m.position.x = m._origPos.x;
          m.position.y = m._origPos.y;
          delete m._origPos;
        }
      }
    }
    triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
  }, [testStartDragPos, testStartPosition, rendererReady]);
}

/**
 * Vehicle start position drag preview (탈것 시작 위치 드래그 시 위치 이동)
 */
export function useVehicleStartDragPreview(
  refs: SyncRefs,
  vehicleStartDragPos: { x: number; y: number; vehicle: 'boat' | 'ship' | 'airship' } | null,
  rendererReady: number,
) {
  const systemData = useEditorStore((s) => s.systemData);
  const currentMapId = useEditorStore((s) => s.currentMapId);

  React.useEffect(() => {
    const meshes = refs.vehicleStartPosMeshesRef.current;
    if (!meshes || meshes.length === 0 || !systemData || !currentMapId) return;

    if (vehicleStartDragPos) {
      const vData = systemData[vehicleStartDragPos.vehicle];
      if (!vData || vData.startMapId !== currentMapId) return;
      const origX = vData.startX;
      const origY = vData.startY;
      const dx = (vehicleStartDragPos.x - origX) * TILE_SIZE_PX;
      const dy = (vehicleStartDragPos.y - origY) * TILE_SIZE_PX;

      // 해당 탈것의 메시들만 이동 (vehicleStartPosMeshesRef에는 모든 탈것 메시가 섞여있음)
      // userData.vehicleKey로 구분하거나 전체 메시를 이동
      // 현재 구조상 전체 메시에 대해 origPos 기준으로 offset 적용
      for (const m of meshes) {
        // 해당 탈것 위치의 메시만 이동 (위치 기반 필터링)
        const mOrigX = m._origPos?.x ?? m.position.x;
        const mOrigY = m._origPos?.y ?? m.position.y;
        const tileCx = origX * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const tileRange = TILE_SIZE_PX * 1.5; // label 포함 범위
        if (Math.abs(mOrigX - tileCx) < tileRange) {
          if (m._origPos === undefined) {
            m._origPos = { x: m.position.x, y: m.position.y };
          }
          m.position.x = m._origPos.x + dx;
          m.position.y = m._origPos.y + dy;
        }
      }
    } else {
      for (const m of meshes) {
        if (m._origPos !== undefined) {
          m.position.x = m._origPos.x;
          m.position.y = m._origPos.y;
          delete m._origPos;
        }
      }
    }
    triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
  }, [vehicleStartDragPos, systemData, currentMapId, rendererReady]);
}
