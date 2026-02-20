import { useEffect, useRef } from 'react';
import useEditorStore from '../../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../../utils/tileHelper';
import { requestRenderFrames } from '../initGameGlobals';
import { createDashedRectBorder, createTextLabel } from './overlayHelpers';
import type { OverlayRefs } from './types';

type CameraZoneRefs = Pick<OverlayRefs, 'rendererObjRef' | 'stageRef' | 'renderRequestedRef'>;

export function useCameraZoneOverlay(
  refs: CameraZoneRefs,
  rendererReady: number,
  cameraZoneMultiDragDelta: { dx: number; dy: number } | null,
  cameraZoneDragPreview: { x: number; y: number; width: number; height: number } | null,
) {
  const editMode = useEditorStore((s) => s.editMode);
  const mode3d = useEditorStore((s) => s.mode3d);
  const selectedCameraZoneIds = useEditorStore((s) => s.selectedCameraZoneIds);
  const cameraZones = useEditorStore((s) => (s.currentMap as any)?.cameraZones ?? null);
  const meshesRef = useRef<any[]>([]);

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    for (const m of meshesRef.current) {
      rendererObj.scene.remove(m);
      m.geometry?.dispose();
      if (m.material?.map) m.material.map.dispose();
      m.material?.dispose();
    }
    meshesRef.current = [];

    if (!mode3d || editMode !== 'cameraZone') {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    const zones: any[] = cameraZones || [];

    for (const zone of zones) {
      const isSelected = selectedCameraZoneIds.includes(zone.id);
      const isDragged = isSelected && cameraZoneMultiDragDelta;
      const zx = zone.x + (isDragged ? cameraZoneMultiDragDelta!.dx : 0);
      const zy = zone.y + (isDragged ? cameraZoneMultiDragDelta!.dy : 0);
      const rw = zone.width * TILE_SIZE_PX;
      const rh = zone.height * TILE_SIZE_PX;
      const cx = zx * TILE_SIZE_PX + rw / 2;
      const cy = zy * TILE_SIZE_PX + rh / 2;
      const fillColor = isSelected ? 0xff8800 : 0x2288ff;
      const strokeColor = isSelected ? 0xffaa44 : 0x44aaff;

      const fillGeom = new THREE.PlaneGeometry(rw, rh);
      const fillMat = new THREE.MeshBasicMaterial({
        color: fillColor, opacity: isSelected ? 0.25 : 0.15,
        transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const fillMesh = new THREE.Mesh(fillGeom, fillMat);
      fillMesh.position.set(cx, cy, 6);
      fillMesh.renderOrder = 9988;
      fillMesh.frustumCulled = false;
      fillMesh.userData.editorGrid = true;
      rendererObj.scene.add(fillMesh);
      meshesRef.current.push(fillMesh);

      const line = createDashedRectBorder(THREE, cx, cy, rw / 2, rh / 2, 6.1, strokeColor, 9989);
      rendererObj.scene.add(line);
      meshesRef.current.push(line);

      if (zone.name) {
        const labelColor = isSelected ? '#ffaa44' : '#88ccff';
        const { mesh: labelMesh } = createTextLabel(THREE, zone.name, 0, 0, 6.2, 9990, labelColor);
        // 좌상단 기준 배치를 위해 position 재조정
        const labelW = TILE_SIZE_PX * 1.5;
        const labelH = labelW * (80 / 320);
        labelMesh.position.set(zx * TILE_SIZE_PX + labelW / 2, zy * TILE_SIZE_PX + labelH / 2 + 2, 6.2);
        rendererObj.scene.add(labelMesh);
        meshesRef.current.push(labelMesh);
      }
    }

    // 드래그 생성 프리뷰
    if (cameraZoneDragPreview) {
      const dp = cameraZoneDragPreview;
      const rw = dp.width * TILE_SIZE_PX;
      const rh = dp.height * TILE_SIZE_PX;
      const cx = dp.x * TILE_SIZE_PX + rw / 2;
      const cy = dp.y * TILE_SIZE_PX + rh / 2;

      const fillGeom = new THREE.PlaneGeometry(rw, rh);
      const fillMat = new THREE.MeshBasicMaterial({
        color: 0x44ff88, opacity: 0.2, transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const fillMesh = new THREE.Mesh(fillGeom, fillMat);
      fillMesh.position.set(cx, cy, 6);
      fillMesh.renderOrder = 9988;
      fillMesh.frustumCulled = false;
      fillMesh.userData.editorGrid = true;
      rendererObj.scene.add(fillMesh);
      meshesRef.current.push(fillMesh);

      const line = createDashedRectBorder(THREE, cx, cy, rw / 2, rh / 2, 6.1, 0x44ff88, 9989);
      rendererObj.scene.add(line);
      meshesRef.current.push(line);
    }

    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [mode3d, editMode, cameraZones, selectedCameraZoneIds, cameraZoneMultiDragDelta, cameraZoneDragPreview, rendererReady]);
}
