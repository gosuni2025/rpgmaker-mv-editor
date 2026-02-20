import { useEffect } from 'react';
import useEditorStore from '../../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../../utils/tileHelper';
import { requestRenderFrames } from '../initGameGlobals';
import { disposeMeshes } from './overlayHelpers';
import type { OverlayRefs } from './types';

export function useLightOverlay(refs: OverlayRefs, rendererReady: number) {
  const lightEditMode = useEditorStore((s) => s.lightEditMode);
  const selectedLightId = useEditorStore((s) => s.selectedLightId);
  const lightPoints = useEditorStore((s) => s.currentMap?.editorLights?.points ?? null);

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    disposeMeshes(rendererObj, refs.lightOverlayMeshesRef);

    if (!lightEditMode || !lightPoints) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    for (const pl of lightPoints) {
      const px = pl.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
      const py = pl.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
      const isSelected = selectedLightId === pl.id;
      const color = new THREE.Color(pl.color);
      const segments = 64;

      // 범위 원 테두리
      const circleGeom = new THREE.RingGeometry(pl.distance - 1, pl.distance, segments);
      const circleMat = new THREE.MeshBasicMaterial({
        color, opacity: 0.2, transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const circle = new THREE.Mesh(circleGeom, circleMat);
      circle.position.set(px, py, 3);
      circle.renderOrder = 9980;
      circle.frustumCulled = false;
      circle.userData.editorGrid = true;
      rendererObj.scene.add(circle);
      refs.lightOverlayMeshesRef.current.push(circle);

      // 범위 원 내부 채우기
      const fillGeom = new THREE.CircleGeometry(pl.distance, segments);
      const fillMat = new THREE.MeshBasicMaterial({
        color, opacity: 0.08, transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const fill = new THREE.Mesh(fillGeom, fillMat);
      fill.position.set(px, py, 2.9);
      fill.renderOrder = 9979;
      fill.frustumCulled = false;
      fill.userData.editorGrid = true;
      rendererObj.scene.add(fill);
      refs.lightOverlayMeshesRef.current.push(fill);

      // 선택/비선택 강조 마커
      const radius = isSelected ? 12 : 9;
      const markerGeom = new THREE.CircleGeometry(radius, 32);
      const markerMat = new THREE.MeshBasicMaterial({
        color, opacity: 0.9, transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.position.set(px, py, 5.5);
      marker.renderOrder = 9985;
      marker.frustumCulled = false;
      marker.userData.editorGrid = true;
      rendererObj.scene.add(marker);
      refs.lightOverlayMeshesRef.current.push(marker);

      // 선택 테두리 링
      const ringGeom = new THREE.RingGeometry(radius - 1.5, radius + 1.5, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xffffff : 0x000000,
        opacity: isSelected ? 1.0 : 0.6,
        transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.set(px, py, 5.6);
      ring.renderOrder = 9986;
      ring.frustumCulled = false;
      ring.userData.editorGrid = true;
      rendererObj.scene.add(ring);
      refs.lightOverlayMeshesRef.current.push(ring);

      // 바닥 위치 점 (Z가 높을 때)
      const pz = pl.z ?? 30;
      if (pz > 2) {
        const dotGeom = new THREE.CircleGeometry(3, 16);
        const dotMat = new THREE.MeshBasicMaterial({
          color, opacity: 0.5, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const dot = new THREE.Mesh(dotGeom, dotMat);
        dot.position.set(px, py, 0.5);
        dot.renderOrder = 9981;
        dot.frustumCulled = false;
        dot.userData.editorGrid = true;
        rendererObj.scene.add(dot);
        refs.lightOverlayMeshesRef.current.push(dot);
      }
    }

    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [lightEditMode, selectedLightId, lightPoints]);
}
