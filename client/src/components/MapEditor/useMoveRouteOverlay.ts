import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import type { MoveCommand, MoveRoute } from '../../types/rpgMakerMV';

const GLOBAL_KEY = '_editorMoveRouteMeshes';

function disposeMeshes(scene: any, globalKey: string) {
  if (!(window as any)[globalKey]) (window as any)[globalKey] = [];
  const existing = (window as any)[globalKey] as any[];
  for (const m of existing) {
    scene.remove(m);
    m.geometry?.dispose();
    if (m.material) {
      if (m.material.map) m.material.map.dispose();
      m.material.dispose();
    }
  }
  existing.length = 0;
  return existing;
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

interface Waypoint {
  x: number;
  y: number;
}

// Game_Character.ROUTE_MOVE_* 코드 → 방향 dx/dy 매핑
// 1=DOWN, 2=LEFT, 3=RIGHT, 4=UP, 5=LOWER_L, 6=LOWER_R, 7=UPPER_L, 8=UPPER_R
const DIRECTION_MAP: Record<number, [number, number]> = {
  1: [0, 1],    // ROUTE_MOVE_DOWN
  2: [-1, 0],   // ROUTE_MOVE_LEFT
  3: [1, 0],    // ROUTE_MOVE_RIGHT
  4: [0, -1],   // ROUTE_MOVE_UP
  5: [-1, 1],   // ROUTE_MOVE_LOWER_L
  6: [1, 1],    // ROUTE_MOVE_LOWER_R
  7: [-1, -1],  // ROUTE_MOVE_UPPER_L
  8: [1, -1],   // ROUTE_MOVE_UPPER_R
};

function computeMoveRoutePath(startX: number, startY: number, moveRoute: MoveRoute): Waypoint[] {
  const path: Waypoint[] = [{ x: startX, y: startY }];
  let cx = startX;
  let cy = startY;

  for (const cmd of moveRoute.list) {
    const code = cmd.code;
    if (code === 0) continue; // end

    // 코드 1~8: 방향 이동
    if (DIRECTION_MAP[code]) {
      const [dx, dy] = DIRECTION_MAP[code];
      cx += dx;
      cy += dy;
      path.push({ x: cx, y: cy });
      continue;
    }

    // 코드 9~13: 랜덤/플레이어방향/전진/후퇴 - 위치 예측 불가, 중단
    if (code >= 9 && code <= 13) break;

    // 코드 14: 점프
    if (code === 14 && cmd.parameters) {
      const dx = cmd.parameters[0] as number;
      const dy = cmd.parameters[1] as number;
      cx += dx;
      cy += dy;
      path.push({ x: cx, y: cy });
      continue;
    }

    // 나머지 코드 (방향전환, 속도변경, 투명도 등): 위치 변화 없음
  }

  return path;
}

// 두 점 사이의 각도
function angleBetween(from: Waypoint, to: Waypoint): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

// 타일 좌표 → 픽셀 중앙
function tileCenter(w: Waypoint): [number, number] {
  return [w.x * TILE_SIZE_PX + TILE_SIZE_PX / 2, w.y * TILE_SIZE_PX + TILE_SIZE_PX / 2];
}

interface OverlayRefs {
  rendererObjRef: React.MutableRefObject<any>;
  stageRef: React.MutableRefObject<any>;
  renderRequestedRef: React.MutableRefObject<boolean>;
}

export function useMoveRouteOverlay(
  refs: OverlayRefs,
  hoverTile: { x: number; y: number } | null,
  rendererReady: number,
) {
  const editMode = useEditorStore((s) => s.editMode);
  const selectedEventIds = useEditorStore((s) => s.selectedEventIds);
  const currentMap = useEditorStore((s) => s.currentMap);

  React.useEffect(() => {
    const rObj = refs.rendererObjRef.current;
    if (!rObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    const meshes = disposeMeshes(rObj.scene, GLOBAL_KEY);

    if (editMode !== 'event' || !currentMap?.events) {
      triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
      return;
    }

    // 대상 이벤트 결정
    let targetEvent: any = null;

    if (selectedEventIds.length === 1) {
      const ev = currentMap.events.find(e => e && e.id === selectedEventIds[0]);
      if (ev) targetEvent = ev;
    }

    if (!targetEvent && (selectedEventIds.length === 0 || selectedEventIds.length > 1) && hoverTile) {
      targetEvent = currentMap.events.find(
        e => e && e.x === hoverTile.x && e.y === hoverTile.y
      );
    }

    if (!targetEvent || !targetEvent.pages || targetEvent.pages.length === 0) {
      triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
      return;
    }

    // 첫 번째 페이지의 moveType 확인
    const page = targetEvent.pages[0];
    if (page.moveType !== 3 || !page.moveRoute || !page.moveRoute.list || page.moveRoute.list.length === 0) {
      triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
      return;
    }

    const path = computeMoveRoutePath(targetEvent.x, targetEvent.y, page.moveRoute);
    if (path.length < 2) {
      triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
      return;
    }

    const Z = 7;
    const LINE_ORDER = 9950;
    const MARKER_ORDER = 9951;
    const ARROW_ORDER = 9952;
    const LABEL_ORDER = 9953;

    // 선분 그리기
    for (let i = 0; i < path.length - 1; i++) {
      const [x1, y1] = tileCenter(path[i]);
      const [x2, y2] = tileCenter(path[i + 1]);

      const pts = [
        new THREE.Vector3(x1, y1, Z),
        new THREE.Vector3(x2, y2, Z),
      ];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xff8800,
        depthTest: false,
        transparent: true,
        opacity: 0.85,
      });
      const line = new THREE.Line(lineGeom, lineMat);
      line.renderOrder = LINE_ORDER;
      line.frustumCulled = false;
      line.userData.editorGrid = true;
      rObj.scene.add(line);
      meshes.push(line);

      // 화살표 머리 (각 선분 중간)
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const angle = angleBetween(path[i], path[i + 1]);
      const arrowSize = 8;

      const triVerts = new Float32Array([
        arrowSize, 0, 0,
        -arrowSize, arrowSize * 0.6, 0,
        -arrowSize, -arrowSize * 0.6, 0,
      ]);
      const triGeom = new THREE.BufferGeometry();
      triGeom.setAttribute('position', new THREE.BufferAttribute(triVerts, 3));
      const triMat = new THREE.MeshBasicMaterial({
        color: 0xff8800,
        depthTest: false,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      });
      const triMesh = new THREE.Mesh(triGeom, triMat);
      triMesh.position.set(mx, my, Z);
      triMesh.rotation.z = angle;
      triMesh.renderOrder = ARROW_ORDER;
      triMesh.frustumCulled = false;
      triMesh.userData.editorGrid = true;
      rObj.scene.add(triMesh);
      meshes.push(triMesh);
    }

    // 시작 마커 (녹색 원)
    {
      const [sx, sy] = tileCenter(path[0]);
      const circGeom = new THREE.CircleGeometry(6, 16);
      const circMat = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        depthTest: false,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      });
      const circle = new THREE.Mesh(circGeom, circMat);
      circle.position.set(sx, sy, Z);
      circle.renderOrder = MARKER_ORDER;
      circle.frustumCulled = false;
      circle.userData.editorGrid = true;
      rObj.scene.add(circle);
      meshes.push(circle);
    }

    // 끝 마커 (빨간 원)
    {
      const last = path[path.length - 1];
      const [ex, ey] = tileCenter(last);
      const circGeom = new THREE.CircleGeometry(6, 16);
      const circMat = new THREE.MeshBasicMaterial({
        color: 0xff4444,
        depthTest: false,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      });
      const circle = new THREE.Mesh(circGeom, circMat);
      circle.position.set(ex, ey, Z);
      circle.renderOrder = MARKER_ORDER;
      circle.frustumCulled = false;
      circle.userData.editorGrid = true;
      rObj.scene.add(circle);
      meshes.push(circle);
    }

    // 반복 표시: 끝→시작 점선
    if (page.moveRoute.repeat && path.length >= 2) {
      const last = path[path.length - 1];
      const first = path[0];
      if (last.x !== first.x || last.y !== first.y) {
        const [lx, ly] = tileCenter(last);
        const [fx, fy] = tileCenter(first);
        const pts = [
          new THREE.Vector3(lx, ly, Z),
          new THREE.Vector3(fx, fy, Z),
        ];
        const dashGeom = new THREE.BufferGeometry().setFromPoints(pts);
        const dashMat = new THREE.LineDashedMaterial({
          color: 0xff8800,
          depthTest: false,
          transparent: true,
          opacity: 0.5,
          dashSize: 8,
          gapSize: 6,
        });
        const dashLine = new THREE.Line(dashGeom, dashMat);
        dashLine.computeLineDistances();
        dashLine.renderOrder = LINE_ORDER;
        dashLine.frustumCulled = false;
        dashLine.userData.editorGrid = true;
        rObj.scene.add(dashLine);
        meshes.push(dashLine);
      }
    }

    // 스텝 번호 라벨
    for (let i = 1; i < path.length; i++) {
      const [px, py] = tileCenter(path[i]);
      const label = String(i);

      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 32, 32);

      // Y-flip 보정 (Mode3D projection matrix 호환)
      ctx.save();
      ctx.translate(0, 32);
      ctx.scale(1, -1);

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.arc(16, 16, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 16, 16);
      ctx.restore();

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      const labelGeom = new THREE.PlaneGeometry(20, 20);
      const labelMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const labelMesh = new THREE.Mesh(labelGeom, labelMat);
      labelMesh.position.set(px + TILE_SIZE_PX * 0.3, py - TILE_SIZE_PX * 0.3, Z);
      labelMesh.renderOrder = LABEL_ORDER;
      labelMesh.frustumCulled = false;
      labelMesh.userData.editorGrid = true;
      rObj.scene.add(labelMesh);
      meshes.push(labelMesh);
    }

    triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
  }, [editMode, selectedEventIds, currentMap?.events, hoverTile, rendererReady]);
}
