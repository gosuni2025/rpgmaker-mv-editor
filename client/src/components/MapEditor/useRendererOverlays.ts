import React, { useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX, isTileA1, isTileA2, isTileA3, isTileA4, isTileA5, isAutotile, TILE_ID_A1 } from '../../utils/tileHelper';
import { requestRenderFrames } from './initGameGlobals';
import type { DragPreviewInfo } from './useThreeRenderer';

interface OverlayRefs {
  rendererObjRef: React.MutableRefObject<any>;
  stageRef: React.MutableRefObject<any>;
  spritesetRef: React.MutableRefObject<any>;
  renderRequestedRef: React.MutableRefObject<boolean>;
  regionMeshesRef: React.MutableRefObject<any[]>;
  startPosMeshesRef: React.MutableRefObject<any[]>;
  testStartPosMeshesRef: React.MutableRefObject<any[]>;
  eventOverlayMeshesRef: React.MutableRefObject<any[]>;
  dragPreviewMeshesRef: React.MutableRefObject<any[]>;
  lightOverlayMeshesRef: React.MutableRefObject<any[]>;
}

/** Region overlay (Three.js meshes) */
export function useRegionOverlay(refs: OverlayRefs, rendererReady: number) {
  const currentLayer = useEditorStore((s) => s.currentLayer);
  const mapWidth = useEditorStore((s) => s.currentMap?.width ?? 0);
  const mapHeight = useEditorStore((s) => s.currentMap?.height ?? 0);
  // Region data만 추출해서 해시 — data 배열 전체 참조 변경에 반응하지 않도록
  const regionHash = useEditorStore((s) => {
    if (!s.currentMap || s.currentLayer !== 5) return '';
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

    // Dispose existing region meshes
    for (const m of refs.regionMeshesRef.current) {
      rendererObj.scene.remove(m);
      m.geometry?.dispose();
      if (m.material?.map) m.material.map.dispose();
      m.material?.dispose();
    }
    refs.regionMeshesRef.current = [];

    if (currentLayer !== 5 || !regionHash) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    // 공유 지오메트리 — 모든 리전 타일에 같은 크기 사용
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
        // Region fill quad (공유 지오메트리)
        const mat = new THREE.MeshBasicMaterial({
          color, opacity: 0.5, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(sharedGeom, mat);
        mesh.position.set(x * TILE_SIZE_PX + TILE_SIZE_PX / 2, y * TILE_SIZE_PX + TILE_SIZE_PX / 2, 4);
        mesh.renderOrder = 9998;
        mesh.frustumCulled = false;
        mesh.userData.editorGrid = true;
        rendererObj.scene.add(mesh);
        refs.regionMeshesRef.current.push(mesh);

        // Region ID text label
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
  }, [regionHash, currentLayer, mapWidth, mapHeight, rendererReady]);
}

/** Player start position overlay (blue border + character image) */
export function usePlayerStartOverlay(refs: OverlayRefs, rendererReady: number) {
  const systemData = useEditorStore((s) => s.systemData);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const playerCharacterName = useEditorStore((s) => s.playerCharacterName);
  const playerCharacterIndex = useEditorStore((s) => s.playerCharacterIndex);

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    // Dispose existing
    for (const m of refs.startPosMeshesRef.current) {
      rendererObj.scene.remove(m);
      if (m.material?.map) m.material.map.dispose();
      m.geometry?.dispose();
      m.material?.dispose();
    }
    refs.startPosMeshesRef.current = [];

    if (!systemData || currentMapId !== systemData.startMapId) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    const px = systemData.startX * TILE_SIZE_PX;
    const py = systemData.startY * TILE_SIZE_PX;
    const cx = px + TILE_SIZE_PX / 2;
    const cy = py + TILE_SIZE_PX / 2;

    // Blue border
    const hw = TILE_SIZE_PX / 2 - 1.5;
    const hh = TILE_SIZE_PX / 2 - 1.5;
    const pts = [
      new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
      new THREE.Vector3(-hw, -hh, 0),
    ];
    const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x0078ff, depthTest: false, transparent: true, opacity: 1.0, linewidth: 3,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    line.position.set(cx, cy, 5.2);
    line.renderOrder = 9995;
    line.frustumCulled = false;
    line.userData.editorGrid = true;
    rendererObj.scene.add(line);
    refs.startPosMeshesRef.current.push(line);

    // "플레이어 시작점" label
    {
      const cvsW = 320;
      const cvsH = 80;
      const cvs = document.createElement('canvas');
      cvs.width = cvsW;
      cvs.height = cvsH;
      const ctx = cvs.getContext('2d')!;
      ctx.clearRect(0, 0, cvsW, cvsH);
      ctx.fillStyle = '#4da6ff';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText('플레이어 시작점', cvsW / 2, cvsH / 2, cvsW - 8);
      const tex = new THREE.CanvasTexture(cvs);
      tex.flipY = false;
      tex.minFilter = THREE.LinearFilter;
      const labelW = TILE_SIZE_PX * 1.5;
      const labelH = labelW * (cvsH / cvsW);
      const labelGeom = new THREE.PlaneGeometry(labelW, labelH);
      const labelMat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const labelMesh = new THREE.Mesh(labelGeom, labelMat);
      labelMesh.position.set(cx, py - labelH / 2 - 2, 5.3);
      labelMesh.renderOrder = 9996;
      labelMesh.frustumCulled = false;
      labelMesh.userData.editorGrid = true;
      rendererObj.scene.add(labelMesh);
      refs.startPosMeshesRef.current.push(labelMesh);
    }

    // Character image (loaded async via CanvasTexture)
    if (playerCharacterName) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!refs.rendererObjRef.current) return;
        const isSingle = playerCharacterName.startsWith('$');
        const charW = isSingle ? img.width / 3 : img.width / 12;
        const charH = isSingle ? img.height / 4 : img.height / 8;
        const charCol = isSingle ? 0 : playerCharacterIndex % 4;
        const charRow = isSingle ? 0 : Math.floor(playerCharacterIndex / 4);
        // Direction: down (row 0), pattern 1 (middle)
        const srcX = charCol * charW * 3 + 1 * charW;
        const srcY = charRow * charH * 4 + 0 * charH;

        const cvs = document.createElement('canvas');
        cvs.width = TILE_SIZE_PX;
        cvs.height = TILE_SIZE_PX;
        const ctx = cvs.getContext('2d')!;
        const scale = Math.min(TILE_SIZE_PX / charW, TILE_SIZE_PX / charH);
        const dw = charW * scale;
        const dh = charH * scale;
        const dx = (TILE_SIZE_PX - dw) / 2;
        const dy = TILE_SIZE_PX - dh;
        ctx.drawImage(img, srcX, srcY, charW, charH, dx, dy, dw, dh);

        const tex = new THREE.CanvasTexture(cvs);
        tex.flipY = false;
        tex.minFilter = THREE.LinearFilter;
        const geom = new THREE.PlaneGeometry(TILE_SIZE_PX, TILE_SIZE_PX);
        const mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(cx, cy, 5.1);
        mesh.renderOrder = 9994;
        mesh.frustumCulled = false;
        mesh.userData.editorGrid = true;
        rendererObj.scene.add(mesh);
        refs.startPosMeshesRef.current.push(mesh);
        requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      };
      img.src = `/api/resources/img_characters/${playerCharacterName}.png`;
    }

    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [systemData, currentMapId, playerCharacterName, playerCharacterIndex, rendererReady]);
}

/** Test start position overlay (green border + character image) - EXT */
export function useTestStartOverlay(refs: OverlayRefs, rendererReady: number) {
  const testStartPosition = useEditorStore((s) => s.currentMap?.testStartPosition ?? null);
  const playerCharacterName = useEditorStore((s) => s.playerCharacterName);
  const playerCharacterIndex = useEditorStore((s) => s.playerCharacterIndex);

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    // Dispose existing
    for (const m of refs.testStartPosMeshesRef.current) {
      rendererObj.scene.remove(m);
      if (m.material?.map) m.material.map.dispose();
      m.geometry?.dispose();
      m.material?.dispose();
    }
    refs.testStartPosMeshesRef.current = [];

    if (!testStartPosition) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    const px = testStartPosition.x * TILE_SIZE_PX;
    const py = testStartPosition.y * TILE_SIZE_PX;
    const cx = px + TILE_SIZE_PX / 2;
    const cy = py + TILE_SIZE_PX / 2;

    // Green border
    const hw = TILE_SIZE_PX / 2 - 1.5;
    const hh = TILE_SIZE_PX / 2 - 1.5;
    const pts = [
      new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
      new THREE.Vector3(-hw, -hh, 0),
    ];
    const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00cc66, depthTest: false, transparent: true, opacity: 1.0, linewidth: 3,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    line.position.set(cx, cy, 5.2);
    line.renderOrder = 9993;
    line.frustumCulled = false;
    line.userData.editorGrid = true;
    rendererObj.scene.add(line);
    refs.testStartPosMeshesRef.current.push(line);

    // "테스트 시작점" label
    {
      const cvsW = 320;
      const cvsH = 80;
      const cvs = document.createElement('canvas');
      cvs.width = cvsW;
      cvs.height = cvsH;
      const ctx = cvs.getContext('2d')!;
      ctx.clearRect(0, 0, cvsW, cvsH);
      ctx.fillStyle = '#66ffaa';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText('테스트 시작점', cvsW / 2, cvsH / 2, cvsW - 8);
      const tex = new THREE.CanvasTexture(cvs);
      tex.flipY = false;
      tex.minFilter = THREE.LinearFilter;
      const labelW = TILE_SIZE_PX * 1.5;
      const labelH = labelW * (cvsH / cvsW);
      const labelGeom = new THREE.PlaneGeometry(labelW, labelH);
      const labelMat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const labelMesh = new THREE.Mesh(labelGeom, labelMat);
      labelMesh.position.set(cx, py - labelH / 2 - 2, 5.3);
      labelMesh.renderOrder = 9994;
      labelMesh.frustumCulled = false;
      labelMesh.userData.editorGrid = true;
      rendererObj.scene.add(labelMesh);
      refs.testStartPosMeshesRef.current.push(labelMesh);
    }

    // Character image (loaded async via CanvasTexture)
    if (playerCharacterName) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!refs.rendererObjRef.current) return;
        const isSingle = playerCharacterName.startsWith('$');
        const charW = isSingle ? img.width / 3 : img.width / 12;
        const charH = isSingle ? img.height / 4 : img.height / 8;
        const charCol = isSingle ? 0 : playerCharacterIndex % 4;
        const charRow = isSingle ? 0 : Math.floor(playerCharacterIndex / 4);
        const srcX = charCol * charW * 3 + 1 * charW;
        const srcY = charRow * charH * 4 + 0 * charH;

        const cvs = document.createElement('canvas');
        cvs.width = TILE_SIZE_PX;
        cvs.height = TILE_SIZE_PX;
        const ctx = cvs.getContext('2d')!;
        const scale = Math.min(TILE_SIZE_PX / charW, TILE_SIZE_PX / charH);
        const dw = charW * scale;
        const dh = charH * scale;
        const dx = (TILE_SIZE_PX - dw) / 2;
        const dy = TILE_SIZE_PX - dh;
        // Green tint overlay
        ctx.globalAlpha = 0.5;
        ctx.drawImage(img, srcX, srcY, charW, charH, dx, dy, dw, dh);
        ctx.globalAlpha = 1.0;
        ctx.drawImage(img, srcX, srcY, charW, charH, dx, dy, dw, dh);

        const tex = new THREE.CanvasTexture(cvs);
        tex.flipY = false;
        tex.minFilter = THREE.LinearFilter;
        const geom = new THREE.PlaneGeometry(TILE_SIZE_PX, TILE_SIZE_PX);
        const mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(cx, cy, 5.1);
        mesh.renderOrder = 9992;
        mesh.frustumCulled = false;
        mesh.userData.editorGrid = true;
        rendererObj.scene.add(mesh);
        refs.testStartPosMeshesRef.current.push(mesh);
        requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      };
      img.src = `/api/resources/img_characters/${playerCharacterName}.png`;
    }

    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [testStartPosition, playerCharacterName, playerCharacterIndex, rendererReady]);
}

/** Event overlay (border + name) in event edit mode */
export function useEventOverlay(refs: OverlayRefs, rendererReady: number) {
  const editMode = useEditorStore((s) => s.editMode);
  // 이벤트 배열 참조만 추적 (currentMap 전체가 아닌)
  const events = useEditorStore((s) => s.currentMap?.events ?? null);

  useEffect(() => {
    const spriteset = refs.spritesetRef.current;
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    // Dispose: 이전 오버레이 제거 (부모에서 remove)
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

    // eventId → Sprite_Character 맵 구축
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
      // 이미지가 있는 이벤트인지 판단 (데이터 기반)
      const hasImage = ev.pages && ev.pages[0]?.image && (
        ev.pages[0].image.characterName || ev.pages[0].image.tileId > 0
      );
      // 이미지가 있는 이벤트만 스프라이트의 _threeObj 자식으로 추가
      const parentObj = hasImage && sprite?._threeObj ? sprite._threeObj : null;
      if (!hasImage) {
        const fillGeom = new THREE.PlaneGeometry(TILE_SIZE_PX, TILE_SIZE_PX);
        const fillMat = new THREE.MeshBasicMaterial({
          color: 0x0078d4, opacity: 0.35, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const fillMesh = new THREE.Mesh(fillGeom, fillMat);
        const ex = ev.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const ey = ev.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        fillMesh.position.set(ex, ey, 5.5);
        fillMesh.renderOrder = 9990;
        fillMesh.frustumCulled = false;
        fillMesh.userData.editorGrid = true;
        rendererObj.scene.add(fillMesh);
        refs.eventOverlayMeshesRef.current.push(fillMesh);
      }

      // 파란색 테두리 (scene에 직접 - 타일 기준 위치)
      const tileX = ev.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
      const tileY = ev.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
      const hw = TILE_SIZE_PX / 2 - 1;
      const hh = TILE_SIZE_PX / 2 - 1;
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
      line.position.set(tileX, tileY, 5.8);
      line.renderOrder = 9991;
      line.frustumCulled = false;
      line.userData.editorGrid = true;
      rendererObj.scene.add(line);
      refs.eventOverlayMeshesRef.current.push(line);

      // 이벤트 이름 라벨 → 스프라이트의 _threeObj 자식으로 추가
      const displayName = ev.name || `EV${String(ev.id).padStart(3, '0')}`;
      const cvsW = 320;
      const cvsH = 80;
      const cvs = document.createElement('canvas');
      cvs.width = cvsW;
      cvs.height = cvsH;
      const ctx = cvs.getContext('2d')!;
      ctx.clearRect(0, 0, cvsW, cvsH);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(displayName, cvsW / 2, cvsH / 2, cvsW - 8);
      const tex = new THREE.CanvasTexture(cvs);
      tex.flipY = false;
      tex.minFilter = THREE.LinearFilter;
      const labelW = TILE_SIZE_PX * 1.5;
      const labelH = labelW * (cvsH / cvsW);
      const labelGeom = new THREE.PlaneGeometry(labelW, labelH);
      const labelMat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const labelMesh = new THREE.Mesh(labelGeom, labelMat);
      labelMesh.renderOrder = 9992;
      labelMesh.frustumCulled = false;
      labelMesh.userData.editorGrid = true;

      if (parentObj) {
        // 스프라이트 자식: 로컬 좌표 (0,0이 스프라이트 위치)
        const spriteH = sprite._threeObj.scale.y || TILE_SIZE_PX;
        labelMesh.position.set(0, -spriteH - labelH / 2 - 2, 1);
        parentObj.add(labelMesh);
      } else {
        // 스프라이트 없으면 scene에 직접
        labelMesh.position.set(tileX, ev.y * TILE_SIZE_PX - labelH / 2 - 2, 5.9);
        rendererObj.scene.add(labelMesh);
      }
      refs.eventOverlayMeshesRef.current.push(labelMesh);
    }

    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [editMode, events, rendererReady]);
}

/** Drag preview overlay (event/light/object drag) */
export function useDragPreviewOverlay(refs: OverlayRefs, dragPreviews: DragPreviewInfo[]) {
  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    // Dispose existing
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

      // Fill quad
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
      rendererObj.scene.add(mesh);
      refs.dragPreviewMeshesRef.current.push(mesh);

      // Stroke outline
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
      rendererObj.scene.add(line);
      refs.dragPreviewMeshesRef.current.push(line);
    }

    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [dragPreviews]);
}

/** Light edit overlay (range circle, selection highlight, ground dot) */
export function useLightOverlay(refs: OverlayRefs, rendererReady: number) {
  const lightEditMode = useEditorStore((s) => s.lightEditMode);
  const selectedLightId = useEditorStore((s) => s.selectedLightId);
  // editorLights.points 배열 참조만 추적
  const lightPoints = useEditorStore((s) => s.currentMap?.editorLights?.points ?? null);

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    // Dispose existing
    for (const m of refs.lightOverlayMeshesRef.current) {
      rendererObj.scene.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
    refs.lightOverlayMeshesRef.current = [];

    if (!lightEditMode || !lightPoints) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    const points = lightPoints;
    for (const pl of points) {
      const px = pl.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
      const py = pl.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
      const isSelected = selectedLightId === pl.id;

      // 1. 범위 원 (distance circle)
      const segments = 64;
      const circleGeom = new THREE.RingGeometry(pl.distance - 1, pl.distance, segments);
      const color = new THREE.Color(pl.color);
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

      // 2. 선택/비선택 강조 (colored circle at light position)
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

      // 선택 테두리
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

      // 3. 바닥 위치 점 (ground dot) - Z가 높을 때
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

/** Fog of War 에디터 미리보기 오버레이 */
export function useFogOfWarOverlay(refs: OverlayRefs & { fogOfWarMeshRef: React.MutableRefObject<any> }, rendererReady: number) {
  const mapWidth = useEditorStore((s) => s.currentMap?.width ?? 0);
  const mapHeight = useEditorStore((s) => s.currentMap?.height ?? 0);
  const disableFow = useEditorStore((s) => s.disableFow);
  const mode3d = useEditorStore((s) => s.mode3d);
  const fogOfWar = useEditorStore((s) => {
    const map = s.currentMap as any;
    return map?.fogOfWar;
  });

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    const FogOfWarMod = (window as any).FogOfWar;
    if (!THREE || !FogOfWarMod) return;

    // 기존 메쉬/그룹 제거
    if (refs.fogOfWarMeshRef.current) {
      rendererObj.scene.remove(refs.fogOfWarMeshRef.current);
      const prev = refs.fogOfWarMeshRef.current;
      if (prev.traverse) {
        prev.traverse((child: any) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      } else {
        prev.geometry?.dispose();
        prev.material?.dispose();
      }
      refs.fogOfWarMeshRef.current = null;
    }
    // FogOfWar 내부 그룹 참조도 정리
    const FogOfWarCleanup = (window as any).FogOfWar;
    if (FogOfWarCleanup) {
      FogOfWarCleanup._fogGroup = null;
      FogOfWarCleanup._fogMesh = null;
    }

    // 2D 모드에서만 활성화 (3D 모드일 땐 3D Volume 사용)
    if (disableFow || !fogOfWar?.enabled2D || mapWidth <= 0 || mapHeight <= 0 || mode3d) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    // FogOfWar 셋업 (에디터 미리보기용)
    FogOfWarMod.setup(mapWidth, mapHeight, fogOfWar);

    // 플레이어 시작 위치 또는 맵 중앙 기준
    const $dataSystem = (window as any).$dataSystem;
    let startX = Math.floor(mapWidth / 2);
    let startY = Math.floor(mapHeight / 2);
    if ($dataSystem) {
      startX = $dataSystem.startX ?? startX;
      startY = $dataSystem.startY ?? startY;
    }
    FogOfWarMod.updateVisibilityAt(startX, startY);

    // 볼류메트릭 메쉬 생성 (런타임과 동일한 셰이더)
    if (!FogOfWarMod._fogTexture) return;

    const totalW = mapWidth * TILE_SIZE_PX;
    const totalH = mapHeight * TILE_SIZE_PX;

    const group = FogOfWarMod._createMesh();
    if (!group) return;

    // 에디터 2D 뷰용: 그룹 위치를 맵 중앙에 배치
    group.position.set(totalW / 2, totalH / 2, 0);
    group.userData.editorGrid = true;
    rendererObj.scene.add(group);
    refs.fogOfWarMeshRef.current = group;

    // 에디터에서 볼류메트릭 셰이더의 카메라 좌표를 설정
    // OrthographicCamera → isOrtho 모드 사용
    const fogMesh = group.children[0];
    if (fogMesh?.material?.uniforms) {
      const u = fogMesh.material.uniforms;
      u.cameraWorldPos.value.set(0, 0, FogOfWarMod._fogHeight + 100);
      u.isOrtho.value = 1.0;
      u.scrollOffset.value.set(0, 0);
      // 에디터에서는 플레이어 위치 = 시작 위치
      u.playerPixelPos.value.set((startX + 0.5) * TILE_SIZE_PX, (startY + 0.5) * TILE_SIZE_PX);
    }

    // 에디터용 라이트 산란 데이터 설정
    const currentMap = (window as any).$dataMap;
    if (fogMesh?.material?.uniforms && currentMap?.editorLights?.points) {
      FogOfWarMod._updateLightUniforms(fogMesh.material.uniforms);
    }

    // 애니메이션 루프: uTime과 카메라 좌표 매 프레임 갱신
    let animId = 0;
    const animate = () => {
      if (!refs.fogOfWarMeshRef.current || refs.fogOfWarMeshRef.current !== group) return;
      FogOfWarMod._time += 1.0 / 60.0;
      if (fogMesh?.material?.uniforms) {
        const u = fogMesh.material.uniforms;
        u.uTime.value = FogOfWarMod._time;
        u.cameraWorldPos.value.set(0, 0, FogOfWarMod._fogHeight + 100);
        // 셰이더 디버그 오버라이드 (런타임 DevPanel에서 조절한 값 반영)
        const so = FogOfWarMod._shaderOverrides || {};
        if (u.dissolveStrength) u.dissolveStrength.value = so.dissolveStrength ?? 2.0;
        if (u.fadeSmoothness) u.fadeSmoothness.value = so.fadeSmoothness ?? 0.3;
        if (u.tentacleSharpness) u.tentacleSharpness.value = so.tentacleSharpness ?? 3.0;
      }
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [rendererReady, mapWidth, mapHeight, disableFow, mode3d, fogOfWar?.enabled2D, fogOfWar?.radius, fogOfWar?.fogColor, fogOfWar?.unexploredAlpha, fogOfWar?.exploredAlpha, fogOfWar?.fogHeight, fogOfWar?.lineOfSight, fogOfWar?.absorption, fogOfWar?.visibilityBrightness, fogOfWar?.edgeAnimation, fogOfWar?.edgeAnimationSpeed, fogOfWar?.fogColorTop, fogOfWar?.heightGradient, fogOfWar?.godRay, fogOfWar?.godRayIntensity, fogOfWar?.vortex, fogOfWar?.vortexSpeed, fogOfWar?.lightScattering, fogOfWar?.lightScatterIntensity]);
}

/** Fog of War 3D Volume (저해상도 RT ray-march + bilateral 업샘플링) 에디터 미리보기 오버레이 */
export function useFogOfWar3DVolumeOverlay(refs: OverlayRefs & { fogOfWarMeshRef: React.MutableRefObject<any> }, rendererReady: number) {
  const mapWidth = useEditorStore((s) => s.currentMap?.width ?? 0);
  const mapHeight = useEditorStore((s) => s.currentMap?.height ?? 0);
  const disableFow = useEditorStore((s) => s.disableFow);
  const mode3d = useEditorStore((s) => s.mode3d);
  const fogOfWar = useEditorStore((s) => {
    const map = s.currentMap as any;
    return map?.fogOfWar;
  });

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const FogOfWarMod = (window as any).FogOfWar;
    const FogOfWar3DVolumeMod = (window as any).FogOfWar3DVolume;
    if (!FogOfWarMod || !FogOfWar3DVolumeMod) return;

    // 기존 3D Volume 정리
    FogOfWar3DVolumeMod.dispose();

    // 3D 모드에서만 활성화 (2D 모드일 땐 2D 셰이더 사용)
    if (disableFow || !fogOfWar?.enabled3D || !mode3d || mapWidth <= 0 || mapHeight <= 0) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    // FogOfWar 가시성 데이터 셋업 (공통)
    FogOfWarMod.setup(mapWidth, mapHeight, fogOfWar);

    // 플레이어 시작 위치
    const $dataSystem = (window as any).$dataSystem;
    let startX = Math.floor(mapWidth / 2);
    let startY = Math.floor(mapHeight / 2);
    if ($dataSystem) {
      startX = $dataSystem.startX ?? startX;
      startY = $dataSystem.startY ?? startY;
    }
    FogOfWarMod.updateVisibilityAt(startX, startY);

    if (!FogOfWarMod._fogTexture) return;

    // fogColor hex → {r, g, b} 0~1
    const hexToRgb = (hex: string) => {
      const c = parseInt(hex.replace('#', ''), 16);
      return { r: ((c >> 16) & 0xff) / 255, g: ((c >> 8) & 0xff) / 255, b: (c & 0xff) / 255 };
    };
    const fogColorRgb = hexToRgb(fogOfWar.fogColor ?? '#000000');
    const fogColorTopRgb = (fogOfWar.heightGradient !== false)
      ? hexToRgb(fogOfWar.fogColorTop ?? '#1a1a26')
      : fogColorRgb;

    // 렌더러 크기 가져오기
    const renderer = rendererObj.renderer;
    const size = renderer.getSize(new (window as any).THREE.Vector2());

    // FogOfWar3DVolume 초기화
    FogOfWar3DVolumeMod.setup(mapWidth, mapHeight, size.x, size.y, {
      resolution: fogOfWar.volumeResolution ?? 4,
      fogHeight: fogOfWar.fogHeight ?? 200,
      absorption: fogOfWar.absorption ?? 0.018,
      fogColor: fogColorRgb,
      fogColorTop: fogColorTopRgb,
    });

    // 기존 렌더 루프에 fog 합성을 삽입하기 위해
    // rendererObj의 afterRender 콜백을 사용 (또는 자체 rAF 루프)
    let animId = 0;
    const animate = () => {
      if (!FogOfWar3DVolumeMod._active) return;

      // FogOfWar 보간
      if (FogOfWarMod._active) {
        FogOfWarMod._lerpDisplay(1.0 / 60.0);
        FogOfWarMod._computeEdgeData(1.0 / 60.0);
        FogOfWarMod._updateTexture();
      }

      // 3D Volume fog 렌더 (메인 씬 위에 합성)
      const camera = rendererObj.camera;
      if (camera) {
        FogOfWar3DVolumeMod.render(renderer, camera, 1.0 / 60.0);
      }

      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      FogOfWar3DVolumeMod.dispose();
    };
  }, [rendererReady, mapWidth, mapHeight, disableFow, mode3d, fogOfWar?.enabled3D, fogOfWar?.radius, fogOfWar?.fogColor, fogOfWar?.unexploredAlpha, fogOfWar?.exploredAlpha, fogOfWar?.fogHeight, fogOfWar?.lineOfSight, fogOfWar?.absorption, fogOfWar?.edgeAnimation, fogOfWar?.edgeAnimationSpeed, fogOfWar?.fogColorTop, fogOfWar?.heightGradient, fogOfWar?.volumeResolution]);
}

/** 타일 시트명 + 번호를 반환 (예: "A2 #5", "B #23") */
function describeTileId(tileId: number): string {
  if (tileId === 0) return '';
  if (isTileA1(tileId)) {
    const kind = Math.floor((tileId - TILE_ID_A1) / 48);
    const shape = (tileId - TILE_ID_A1) % 48;
    return `A1\nk${kind} s${shape}`;
  }
  if (isTileA2(tileId)) {
    const kind = Math.floor((tileId - 2816) / 48);
    const shape = (tileId - 2816) % 48;
    return `A2\nk${kind} s${shape}`;
  }
  if (isTileA3(tileId)) {
    const kind = Math.floor((tileId - 4352) / 48);
    const shape = (tileId - 4352) % 48;
    return `A3\nk${kind} s${shape}`;
  }
  if (isTileA4(tileId)) {
    const kind = Math.floor((tileId - 5888) / 48);
    const shape = (tileId - 5888) % 48;
    return `A4\nk${kind} s${shape}`;
  }
  if (isTileA5(tileId)) {
    const idx = tileId - 1536;
    return `A5\n#${idx}`;
  }
  // B/C/D/E tiles
  if (tileId < 256) return `B\n#${tileId}`;
  if (tileId < 512) return `C\n#${tileId - 256}`;
  if (tileId < 768) return `D\n#${tileId - 512}`;
  if (tileId < 1024) return `E\n#${tileId - 768}`;
  return `#${tileId}`;
}

/** 레이어별 색상 */
const LAYER_COLORS = ['#4fc3f7', '#81c784', '#ffb74d', '#f06292'];

/** Tile ID 디버그 오버레이 — 그리드 위에 각 타일의 시트명과 번호 표시 */
export function useTileIdDebugOverlay(
  refs: OverlayRefs & { tileIdDebugMeshesRef: React.MutableRefObject<any[]> },
  showTileId: boolean,
  rendererReady: number,
) {
  const mapWidth = useEditorStore((s) => s.currentMap?.width ?? 0);
  const mapHeight = useEditorStore((s) => s.currentMap?.height ?? 0);
  // 맵 데이터 변경 추적을 위한 간단한 해시 (data 참조 변경으로)
  const mapData = useEditorStore((s) => s.currentMap?.data ?? null);

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    // 기존 메시 제거
    for (const m of refs.tileIdDebugMeshesRef.current) {
      rendererObj.scene.remove(m);
      m.geometry?.dispose();
      if (m.material?.map) m.material.map.dispose();
      m.material?.dispose();
    }
    refs.tileIdDebugMeshesRef.current = [];

    if (!showTileId || !mapData || mapWidth <= 0 || mapHeight <= 0) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    // 공유 지오메트리
    const sharedGeom = new THREE.PlaneGeometry(TILE_SIZE_PX, TILE_SIZE_PX);

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        // 레이어 0~3의 타일 정보 수집
        const lines: { text: string; color: string }[] = [];
        for (let z = 0; z < 4; z++) {
          const idx = (z * mapHeight + y) * mapWidth + x;
          const tileId = mapData[idx];
          if (!tileId || tileId === 0) continue;
          const desc = describeTileId(tileId);
          if (desc) {
            lines.push({ text: `L${z}:${desc.replace('\n', ' ')}`, color: LAYER_COLORS[z] });
          }
        }
        if (lines.length === 0) continue;

        // Canvas에 다중 레이어 정보 렌더링
        const cvsW = 128;
        const cvsH = 128;
        const cvs = document.createElement('canvas');
        cvs.width = cvsW;
        cvs.height = cvsH;
        const ctx = cvs.getContext('2d')!;
        ctx.clearRect(0, 0, cvsW, cvsH);

        // 반투명 배경
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        const r = 6;
        const bx = 4, by = 4, bw = cvsW - 8, bh = cvsH - 8;
        ctx.moveTo(bx + r, by);
        ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
        ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
        ctx.arcTo(bx, by + bh, bx, by, r);
        ctx.arcTo(bx, by, bx + bw, by, r);
        ctx.fill();

        const fontSize = lines.length <= 2 ? 22 : lines.length <= 3 ? 18 : 15;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 2;

        const totalH = lines.length * (fontSize + 4);
        const startY = (cvsH - totalH) / 2 + (fontSize + 4) / 2;

        for (let i = 0; i < lines.length; i++) {
          ctx.fillStyle = lines[i].color;
          ctx.fillText(lines[i].text, cvsW / 2, startY + i * (fontSize + 4), cvsW - 12);
        }

        const tex = new THREE.CanvasTexture(cvs);
        tex.minFilter = THREE.LinearFilter;
        const mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(sharedGeom, mat);
        mesh.position.set(
          x * TILE_SIZE_PX + TILE_SIZE_PX / 2,
          y * TILE_SIZE_PX + TILE_SIZE_PX / 2,
          4.8,
        );
        mesh.renderOrder = 9997;
        mesh.frustumCulled = false;
        mesh.userData.editorGrid = true;
        rendererObj.scene.add(mesh);
        refs.tileIdDebugMeshesRef.current.push(mesh);
      }
    }

    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [showTileId, mapData, mapWidth, mapHeight, rendererReady]);
}
