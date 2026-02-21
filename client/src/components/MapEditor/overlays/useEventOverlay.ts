import { useEffect } from 'react';
import useEditorStore from '../../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../../utils/tileHelper';
import { requestRenderFrames } from '../initGameGlobals';
import { createRectBorder, createTextLabel } from './overlayHelpers';
import type { OverlayRefs } from './types';

export function useEventOverlay(refs: OverlayRefs, rendererReady: number) {
  const editMode = useEditorStore((s) => s.editMode);
  const events = useEditorStore((s) => s.currentMap?.events ?? null);

  useEffect(() => {
    const spriteset = refs.spritesetRef.current;
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    for (const m of refs.eventOverlayMeshesRef.current) {
      if (m.parent) m.parent.remove(m);
      if (m.material?.map) m.material.map.dispose();
      m.geometry?.dispose();
      m.material?.dispose();
    }
    refs.eventOverlayMeshesRef.current = [];

    if (editMode !== 'event' || !events || !spriteset?._characterSprites) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    const charSprites = spriteset._characterSprites as any[];
    const eventSpriteMap = new Map<number, any>();
    for (const cs of charSprites) {
      if (cs._character && cs._character._eventId) {
        eventSpriteMap.set(cs._character._eventId, cs);
      }
    }

    for (let i = 1; i < events.length; i++) {
      const ev = events[i];
      if (!ev) continue;

      const sprite = eventSpriteMap.get(ev.id);
      const hasImage = ev.pages && ev.pages[0]?.image && (
        ev.pages[0].image.characterName || ev.pages[0].image.tileId > 0
      );
      const parentObj = hasImage && sprite?._threeObj ? sprite._threeObj : null;

      if (!hasImage) {
        const fillGeom = new THREE.PlaneGeometry(TILE_SIZE_PX, TILE_SIZE_PX);
        const fillMat = new THREE.MeshBasicMaterial({
          color: 0x0078d4, opacity: 0.35, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const fillMesh = new THREE.Mesh(fillGeom, fillMat);
        fillMesh.position.set(ev.x * TILE_SIZE_PX + TILE_SIZE_PX / 2, ev.y * TILE_SIZE_PX + TILE_SIZE_PX / 2, 5.5);
        fillMesh.renderOrder = 9990;
        fillMesh.frustumCulled = false;
        fillMesh.userData.editorGrid = true;
        rendererObj.scene.add(fillMesh);
        refs.eventOverlayMeshesRef.current.push(fillMesh);
      }

      const tileX = ev.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
      const tileY = ev.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
      const line = createRectBorder(THREE, tileX, tileY, TILE_SIZE_PX / 2 - 1, TILE_SIZE_PX / 2 - 1, 5.8, 0x0078d4, 9991);
      rendererObj.scene.add(line);
      refs.eventOverlayMeshesRef.current.push(line);

      const displayName = ev.name || `EV${String(ev.id).padStart(3, '0')}`;
      const { mesh: labelMesh, labelH } = createTextLabel(THREE, displayName, tileX, 0, 5.9, 9992, '#fff');
      labelMesh.renderOrder = 9992;

      if (parentObj) {
        const spriteH = sprite._threeObj.scale.y || TILE_SIZE_PX;
        labelMesh.position.set(0, -spriteH - labelH / 2 - 2, 1);
        parentObj.add(labelMesh);
      } else {
        labelMesh.position.set(tileX, ev.y * TILE_SIZE_PX - labelH / 2 - 2, 5.9);
        rendererObj.scene.add(labelMesh);
      }
      refs.eventOverlayMeshesRef.current.push(labelMesh);
    }

    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [editMode, events, rendererReady]);
}
