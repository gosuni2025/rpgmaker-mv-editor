import React, { useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import { requestRenderFrames } from './initGameGlobals';
import type { DragPreviewInfo } from './useThreeRenderer';

interface OverlayRefs {
  rendererObjRef: React.MutableRefObject<any>;
  stageRef: React.MutableRefObject<any>;
  spritesetRef: React.MutableRefObject<any>;
  renderRequestedRef: React.MutableRefObject<boolean>;
  regionMeshesRef: React.MutableRefObject<any[]>;
  startPosMeshesRef: React.MutableRefObject<any[]>;
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

    if (disableFow || !fogOfWar?.enabled || mapWidth <= 0 || mapHeight <= 0) {
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
        // isOrtho 모드: cameraWorldPos.z만 의미 있음 (xy는 vWorldPos에서 가져옴)
        u.cameraWorldPos.value.set(0, 0, FogOfWarMod._fogHeight + 100);
      }
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [rendererReady, mapWidth, mapHeight, disableFow, fogOfWar?.enabled, fogOfWar?.radius, fogOfWar?.fogColor, fogOfWar?.unexploredAlpha, fogOfWar?.exploredAlpha, fogOfWar?.fogHeight, fogOfWar?.lineOfSight, fogOfWar?.absorption, fogOfWar?.visibilityBrightness, fogOfWar?.edgeAnimation, fogOfWar?.edgeAnimationSpeed, fogOfWar?.fogColorTop, fogOfWar?.heightGradient, fogOfWar?.godRay, fogOfWar?.godRayIntensity, fogOfWar?.vortex, fogOfWar?.vortexSpeed, fogOfWar?.lightScattering, fogOfWar?.lightScatterIntensity]);
}
