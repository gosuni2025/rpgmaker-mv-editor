import { useEffect } from 'react';
import useEditorStore from '../../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../../utils/tileHelper';
import { requestRenderFrames } from '../initGameGlobals';
import type { OverlayRefs } from './types';

export function useRegionOverlay(refs: OverlayRefs, rendererReady: number) {
  const currentLayer = useEditorStore((s) => s.currentLayer);
  const showRegion = useEditorStore((s) => s.showRegion);
  const editMode = useEditorStore((s) => s.editMode);
  const mapWidth = useEditorStore((s) => s.currentMap?.width ?? 0);
  const mapHeight = useEditorStore((s) => s.currentMap?.height ?? 0);
  const regionHash = useEditorStore((s) => {
    if (!s.currentMap) return '';
    const isRTabActive = s.editMode === 'map' && s.currentLayer === 5;
    if (!s.showRegion && !isRTabActive) return '';
    const { width, height, data } = s.currentMap;
    const parts: string[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const regionId = data[(5 * height + y) * width + x];
        if (regionId !== 0) parts.push(`${x},${y},${regionId}`);
      }
    }
    return parts.join(';');
  });

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    for (const m of refs.regionMeshesRef.current) {
      rendererObj.scene.remove(m);
      m.geometry?.dispose();
      if (m.material?.map) m.material.map.dispose();
      m.material?.dispose();
    }
    refs.regionMeshesRef.current = [];

    if (!regionHash) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    const isRegionMode = editMode === 'map' && currentLayer === 5;
    const fillOpacity = isRegionMode ? 0.5 : 0.25;
    const showLabel = isRegionMode || showRegion;

    const sharedGeom = new THREE.PlaneGeometry(TILE_SIZE_PX, TILE_SIZE_PX);
    const sharedLabelGeom = new THREE.PlaneGeometry(TILE_SIZE_PX * 0.6, TILE_SIZE_PX * 0.6);

    const currentMap = useEditorStore.getState().currentMap;
    if (!currentMap) return;
    const { width, height, data } = currentMap;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const regionId = data[(5 * height + y) * width + x];
        if (regionId === 0) continue;
        const hue = (regionId * 137) % 360;
        const color = new THREE.Color(`hsl(${hue}, 60%, 40%)`);

        const mat = new THREE.MeshBasicMaterial({
          color, opacity: fillOpacity, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(sharedGeom, mat);
        mesh.position.set(x * TILE_SIZE_PX + TILE_SIZE_PX / 2, y * TILE_SIZE_PX + TILE_SIZE_PX / 2, 4);
        mesh.renderOrder = 9998;
        mesh.frustumCulled = false;
        mesh.userData.editorGrid = true;
        rendererObj.scene.add(mesh);
        refs.regionMeshesRef.current.push(mesh);

        if (!showLabel) continue;

        const cvs = document.createElement('canvas');
        cvs.width = 48; cvs.height = 48;
        const ctx = cvs.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 3;
        ctx.fillText(String(regionId), 24, 24);
        const tex = new THREE.CanvasTexture(cvs);
        tex.flipY = false;
        const labelMat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const labelMesh = new THREE.Mesh(sharedLabelGeom, labelMat);
        labelMesh.position.set(x * TILE_SIZE_PX + TILE_SIZE_PX / 2, y * TILE_SIZE_PX + TILE_SIZE_PX / 2, 4.5);
        labelMesh.renderOrder = 9999;
        labelMesh.frustumCulled = false;
        labelMesh.userData.editorGrid = true;
        rendererObj.scene.add(labelMesh);
        refs.regionMeshesRef.current.push(labelMesh);
      }
    }
    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [regionHash, currentLayer, editMode, showRegion, mapWidth, mapHeight, rendererReady]);
}
