import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import {
  OverlayRefs,
  disposeMeshes,
  triggerRender,
  createHighlightMesh,
  createDragSelectionArea,
  createPastePreview,
  getPassabilityTexture,
} from './useEntitySelectionOverlaysUtils';

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
  const selectedStartPosition = useEditorStore((s) => s.selectedStartPosition);
  const systemData = useEditorStore((s) => s.systemData);
  const currentMapId = useEditorStore((s) => s.currentMapId);

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

    // 1.5. 선택된 시작 위치 하이라이트
    if (editMode === 'event' && selectedStartPosition && systemData) {
      let sx: number | undefined, sy: number | undefined, highlightColor: number | undefined;
      if (selectedStartPosition === 'player' && currentMapId === systemData.startMapId) {
        sx = systemData.startX;
        sy = systemData.startY;
        highlightColor = 0x4488ff;
      } else if (selectedStartPosition === 'boat' || selectedStartPosition === 'ship' || selectedStartPosition === 'airship') {
        const vData = systemData[selectedStartPosition];
        if (vData && vData.startMapId === currentMapId) {
          sx = vData.startX;
          sy = vData.startY;
          highlightColor = selectedStartPosition === 'boat' ? 0xff9933
            : selectedStartPosition === 'ship' ? 0x9966ff
            : 0xff3399;
        }
      }
      if (sx !== undefined && sy !== undefined && highlightColor !== undefined) {
        const cx = sx * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const cy = sy * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        createHighlightMesh(THREE, rObj.scene, meshes, cx, cy, TILE_SIZE_PX, TILE_SIZE_PX, highlightColor, highlightColor, 5.5, 5.8, 9998, 9999);
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
  }, [editMode, selectedEventIds, eventSelectionStart, eventSelectionEnd, isEventPasting, eventPastePreviewPos, clipboard, currentMap?.events, selectedStartPosition, systemData, currentMapId, rendererReady]);
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
  const showPassability = useEditorStore((s) => s.showPassability);

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
        const isImageObj = !!obj.imageName;
        const isAnimObj = !!obj.animationId;
        if (isImageObj || isAnimObj) {
          // 이미지 오브젝트: 전체 영역을 하나의 박스로 표시 (이미지가 보이도록 채우기를 연하게)
          const rw = ow * TILE_SIZE_PX;
          const rh = oh * TILE_SIZE_PX;
          const cx = obj.x * TILE_SIZE_PX + rw / 2;
          const cy = (obj.y - oh + 1) * TILE_SIZE_PX + rh / 2;
          createHighlightMesh(THREE, rObj.scene, meshes, cx, cy, rw, rh, fillColor, strokeColor, 5.5, 5.8, 9998, 9999, isSelected ? 0.15 : 0.05);
          // 앵커 마커: 빨간 원 + 노란 테두리
          const objAnchorY = obj.anchorY != null ? obj.anchorY : 1.0;
          const topY = (obj.y - oh + 1) * TILE_SIZE_PX;
          const anchorPx = topY + rh * objAnchorY;
          const anchorCx = obj.x * TILE_SIZE_PX + rw / 2;
          const markerRadius = 5;
          const segments = 16;
          // 빨간 원 (채우기)
          const circleShape = new THREE.Shape();
          circleShape.absarc(0, 0, markerRadius, 0, Math.PI * 2, false);
          const circleGeom = new THREE.ShapeGeometry(circleShape, segments);
          const circleMat = new THREE.MeshBasicMaterial({
            color: 0xff3232, opacity: 0.85, transparent: true,
            depthTest: false, side: THREE.DoubleSide,
          });
          const circleMesh = new THREE.Mesh(circleGeom, circleMat);
          circleMesh.position.set(anchorCx, anchorPx, 6.2);
          circleMesh.renderOrder = 10010;
          circleMesh.frustumCulled = false;
          circleMesh.userData.editorGrid = true;
          rObj.scene.add(circleMesh);
          meshes.push(circleMesh);
          // 노란 테두리
          const ringPts: any[] = [];
          for (let si = 0; si <= segments; si++) {
            const angle = (si / segments) * Math.PI * 2;
            ringPts.push(new THREE.Vector3(Math.cos(angle) * markerRadius, Math.sin(angle) * markerRadius, 0));
          }
          const ringGeom = new THREE.BufferGeometry().setFromPoints(ringPts);
          const ringMat = new THREE.LineBasicMaterial({
            color: 0xffcc00, depthTest: false, transparent: true, opacity: 1.0,
          });
          const ringLine = new THREE.Line(ringGeom, ringMat);
          ringLine.position.set(anchorCx, anchorPx, 6.3);
          ringLine.renderOrder = 10011;
          ringLine.frustumCulled = false;
          ringLine.userData.editorGrid = true;
          rObj.scene.add(ringLine);
          meshes.push(ringLine);
        } else if (tileIds && tileIds.length > 0) {
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

    // 0.5. 선택된 오브젝트의 통행 설정 영역 외곽선 (전체 passability 영역)
    if (isObjMode && selectedSet.size > 0 && currentMap?.objects) {
      for (const obj of currentMap.objects as any[]) {
        if (!obj || !selectedSet.has(obj.id) || !obj.passability) continue;
        const ow = obj.width || 1;
        const oh = obj.height || 1;
        const baseX = obj.x;
        const baseY = obj.y - oh + 1;

        // passability 배열이 존재하는 모든 타일을 하나의 세트로
        const allPassTiles = new Set<string>();
        for (let row = 0; row < oh; row++) {
          const passRow = obj.passability[row];
          if (!passRow) continue;
          for (let col = 0; col < ow; col++) {
            allPassTiles.add(`${col},${row}`);
          }
        }
        if (allPassTiles.size === 0) continue;

        // 외곽 엣지 수집
        const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
        for (const key of allPassTiles) {
          const [cs, rs] = key.split(',');
          const col = parseInt(cs), row = parseInt(rs);
          if (!allPassTiles.has(`${col},${row - 1}`))
            edges.push({ x1: col, y1: row, x2: col + 1, y2: row });
          if (!allPassTiles.has(`${col},${row + 1}`))
            edges.push({ x1: col + 1, y1: row + 1, x2: col, y2: row + 1 });
          if (!allPassTiles.has(`${col - 1},${row}`))
            edges.push({ x1: col, y1: row + 1, x2: col, y2: row });
          if (!allPassTiles.has(`${col + 1},${row}`))
            edges.push({ x1: col + 1, y1: row, x2: col + 1, y2: row + 1 });
        }

        // 엣지들을 연결된 폴리라인으로 병합
        const edgeMap = new Map<string, { x: number; y: number }[]>();
        for (const e of edges) {
          const sk = `${e.x1},${e.y1}`;
          if (!edgeMap.has(sk)) edgeMap.set(sk, []);
          edgeMap.get(sk)!.push({ x: e.x2, y: e.y2 });
        }
        const usedEdges = new Set<string>();
        for (const e of edges) {
          const ek = `${e.x1},${e.y1}-${e.x2},${e.y2}`;
          if (usedEdges.has(ek)) continue;
          const chain: { x: number; y: number }[] = [{ x: e.x1, y: e.y1 }];
          let next = { x: e.x2, y: e.y2 };
          usedEdges.add(ek);
          chain.push(next);
          while (true) {
            const candidates = edgeMap.get(`${next.x},${next.y}`);
            if (!candidates) break;
            let found = false;
            for (const c of candidates) {
              const ck = `${next.x},${next.y}-${c.x},${c.y}`;
              if (!usedEdges.has(ck)) {
                usedEdges.add(ck);
                next = c;
                chain.push(next);
                found = true;
                break;
              }
            }
            if (!found) break;
          }
          // 월드 좌표로 변환하여 라인 렌더링
          const points = chain.map(p =>
            new THREE.Vector3(
              (baseX + p.x) * TILE_SIZE_PX,
              (baseY + p.y) * TILE_SIZE_PX,
              0
            )
          );
          const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
          const lineMat = new THREE.LineBasicMaterial({
            color: 0xffaa00, depthTest: false, transparent: true, opacity: 0.9,
          });
          const line = new THREE.Line(lineGeom, lineMat);
          line.position.set(0, 0, 6.0);
          line.renderOrder = 10015;
          line.frustumCulled = false;
          line.userData.editorGrid = true;
          rObj.scene.add(line);
          meshes.push(line);
        }
      }
    }

    // 1. 통행 표시 (O/X)
    if (isObjMode && showPassability && currentMap?.objects) {
      for (const obj of currentMap.objects as any[]) {
        if (!obj || !obj.passability) continue;
        const ow = obj.width || 1;
        const oh = obj.height || 1;
        for (let row = 0; row < oh; row++) {
          const passRow = obj.passability[row];
          if (!passRow) continue;
          for (let col = 0; col < ow; col++) {
            const passable = passRow[col] !== false;
            const tx = obj.x + col;
            const ty = (obj.y - oh + 1) + row;
            const cx = tx * TILE_SIZE_PX + TILE_SIZE_PX / 2;
            const cy = ty * TILE_SIZE_PX + TILE_SIZE_PX / 2;
            const iconSize = 20;
            const geom = new THREE.PlaneGeometry(iconSize, iconSize);
            const mat = new THREE.MeshBasicMaterial({
              map: getPassabilityTexture(THREE, passable),
              transparent: true,
              depthTest: false,
              side: THREE.DoubleSide,
            });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(cx, cy, 7.0);
            mesh.renderOrder = 10020;
            mesh.frustumCulled = false;
            mesh.userData.editorGrid = true;
            rObj.scene.add(mesh);
            meshes.push(mesh);
          }
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
  }, [editMode, selectedObjectIds, objectSelectionStart, objectSelectionEnd, isObjectPasting, objectPastePreviewPos, clipboard, currentMap?.objects, objectPaintTiles, showPassability, rendererReady]);
}
