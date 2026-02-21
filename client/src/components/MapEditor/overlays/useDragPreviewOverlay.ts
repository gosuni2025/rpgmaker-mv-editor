import { useEffect } from 'react';
import { TILE_SIZE_PX } from '../../../utils/tileHelper';
import { requestRenderFrames } from '../initGameGlobals';
import { createRectBorder } from './overlayHelpers';
import type { OverlayRefs } from './types';
import type { DragPreviewInfo } from '../useThreeRenderer';

export function useDragPreviewOverlay(refs: OverlayRefs, dragPreviews: DragPreviewInfo[]) {
  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    for (const m of refs.dragPreviewMeshesRef.current) {
      rendererObj.scene.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
    refs.dragPreviewMeshesRef.current = [];

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

      const rw = TILE_SIZE_PX * dpW, rh = TILE_SIZE_PX * dpH;
      const cx = dp.x * TILE_SIZE_PX + rw / 2;
      const cy = dp.type === 'object'
        ? (dp.y - dpH + 1) * TILE_SIZE_PX + rh / 2
        : dp.y * TILE_SIZE_PX + rh / 2;

      const geom = new THREE.PlaneGeometry(rw, rh);
      const mat = new THREE.MeshBasicMaterial({
        color: fillColor, opacity: 0.4, transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(cx, cy, 6);
      mesh.renderOrder = 10000;
      mesh.frustumCulled = false;
      mesh.userData.editorGrid = true;
      rendererObj.scene.add(mesh);
      refs.dragPreviewMeshesRef.current.push(mesh);

      const line = createRectBorder(THREE, cx, cy, rw / 2, rh / 2, 6.5, strokeColor, 10001);
      rendererObj.scene.add(line);
      refs.dragPreviewMeshesRef.current.push(line);
    }

    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [dragPreviews]);
}
