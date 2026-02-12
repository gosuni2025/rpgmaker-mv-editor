import { useCallback } from 'react';
import { TILE_SIZE_PX } from '../../utils/tileHelper';

export interface DrawingOverlayRefs {
  toolPreviewMeshesRef: React.MutableRefObject<any[]>;
  rendererObjRef: React.MutableRefObject<any>;
  stageRef: React.MutableRefObject<any>;
  renderRequestedRef: React.MutableRefObject<boolean>;
}

export interface DrawingOverlayResult {
  drawOverlayPreview: (start: { x: number; y: number }, end: { x: number; y: number }) => void;
  clearOverlay: () => void;
}

function triggerRender(refs: DrawingOverlayRefs) {
  if (!refs.renderRequestedRef.current) {
    refs.renderRequestedRef.current = true;
    requestAnimationFrame(() => {
      refs.renderRequestedRef.current = false;
      if (!refs.rendererObjRef.current || !refs.stageRef.current) return;
      const strategy = (window as any).RendererStrategy?.getStrategy();
      if (strategy) strategy.render(refs.rendererObjRef.current, refs.stageRef.current);
    });
  }
}

function clearPreviewMeshes(refs: DrawingOverlayRefs) {
  const rObj = refs.rendererObjRef.current;
  if (!rObj) return;
  for (const m of refs.toolPreviewMeshesRef.current) {
    rObj.scene.remove(m);
    m.geometry?.dispose();
    m.material?.dispose();
  }
  refs.toolPreviewMeshesRef.current = [];
}

export function useDrawingOverlay(
  selectedTool: string,
  refs: DrawingOverlayRefs,
): DrawingOverlayResult {
  const drawOverlayPreview = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const rObj = refs.rendererObjRef.current;
      if (!rObj) return;
      const THREE = (window as any).THREE;
      if (!THREE) return;

      clearPreviewMeshes(refs);

      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);

      if (selectedTool === 'rectangle') {
        const rw = (maxX - minX + 1) * TILE_SIZE_PX;
        const rh = (maxY - minY + 1) * TILE_SIZE_PX;
        const cx = minX * TILE_SIZE_PX + rw / 2;
        const cy = minY * TILE_SIZE_PX + rh / 2;
        // Fill
        const geom = new THREE.PlaneGeometry(rw, rh);
        const mat = new THREE.MeshBasicMaterial({
          color: 0x0078d4, opacity: 0.3, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(cx, cy, 7);
        mesh.renderOrder = 10002;
        mesh.frustumCulled = false;
        mesh.userData.editorGrid = true;
        rObj.scene.add(mesh);
        refs.toolPreviewMeshesRef.current.push(mesh);
        // Outline
        const hw = rw / 2, hh = rh / 2;
        const pts = [
          new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
          new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
          new THREE.Vector3(-hw, -hh, 0),
        ];
        const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x0078d4, depthTest: false, transparent: true, opacity: 1.0,
        });
        const line = new THREE.Line(lineGeom, lineMat);
        line.position.set(cx, cy, 7.5);
        line.renderOrder = 10003;
        line.frustumCulled = false;
        line.userData.editorGrid = true;
        rObj.scene.add(line);
        refs.toolPreviewMeshesRef.current.push(line);
      } else if (selectedTool === 'ellipse') {
        const rw = (maxX - minX + 1) * TILE_SIZE_PX;
        const rh = (maxY - minY + 1) * TILE_SIZE_PX;
        const cx = minX * TILE_SIZE_PX + rw / 2;
        const cy = minY * TILE_SIZE_PX + rh / 2;
        // Create ellipse shape via EllipseCurve
        const curve = new THREE.EllipseCurve(0, 0, rw / 2, rh / 2, 0, 2 * Math.PI, false, 0);
        const points = curve.getPoints(64);
        const points3d = points.map((p: any) => new THREE.Vector3(p.x, p.y, 0));
        // Fill (approximate with ShapeGeometry)
        const shape = new THREE.Shape();
        shape.absellipse(0, 0, rw / 2, rh / 2, 0, 2 * Math.PI, false, 0);
        const fillGeom = new THREE.ShapeGeometry(shape, 64);
        const fillMat = new THREE.MeshBasicMaterial({
          color: 0x0078d4, opacity: 0.3, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const fillMesh = new THREE.Mesh(fillGeom, fillMat);
        fillMesh.position.set(cx, cy, 7);
        fillMesh.renderOrder = 10002;
        fillMesh.frustumCulled = false;
        fillMesh.userData.editorGrid = true;
        rObj.scene.add(fillMesh);
        refs.toolPreviewMeshesRef.current.push(fillMesh);
        // Outline
        const lineGeom = new THREE.BufferGeometry().setFromPoints(points3d);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x0078d4, depthTest: false, transparent: true, opacity: 1.0,
        });
        const line = new THREE.Line(lineGeom, lineMat);
        line.position.set(cx, cy, 7.5);
        line.renderOrder = 10003;
        line.frustumCulled = false;
        line.userData.editorGrid = true;
        rObj.scene.add(line);
        refs.toolPreviewMeshesRef.current.push(line);
      }

      triggerRender(refs);
    },
    [selectedTool]
  );

  const clearOverlay = useCallback(() => {
    clearPreviewMeshes(refs);
    triggerRender(refs);
  }, []);

  return { drawOverlayPreview, clearOverlay };
}
