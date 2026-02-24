/**
 * useWaypointMode — 웨이포인트 편집 모드 마우스 처리
 *
 * 이벤트 모드에서 window._editorWaypointSession이 있을 때:
 * - 웨이포인트 마커 위 클릭: 드래그 시작
 * - A* 경로 선분 위 클릭: 해당 구간에 웨이포인트 삽입
 * - 그 외 빈 공간 클릭: 마지막에 추가
 * - 드래그: 웨이포인트 위치 업데이트
 */

import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import type { WaypointSession, WaypointPos } from '../../utils/astar';
import { runAstar } from '../../utils/astar';

function canvasToTile(
  e: MouseEvent,
  canvas: HTMLCanvasElement,
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const cx = (e.clientX - rect.left) * scaleX;
  const cy = (e.clientY - rect.top) * scaleY;
  return {
    x: Math.floor(cx / TILE_SIZE_PX),
    y: Math.floor(cy / TILE_SIZE_PX),
  };
}

/** 타일 위치와 웨이포인트가 일치하면 반환 */
function findWaypointAt(session: WaypointSession, tx: number, ty: number): WaypointPos | null {
  return session.waypoints.find(wp => wp.x === tx && wp.y === ty) ?? null;
}

/**
 * 클릭한 타일이 어느 구간의 A* 경로 위에 속하는지 확인.
 * @returns 삽입할 인덱스 (i번째 웨이포인트 앞에 삽입), 경로 위가 아니면 -1
 */
function findSegmentIndex(
  session: WaypointSession,
  clickX: number, clickY: number,
  data: number[], mapWidth: number, mapHeight: number,
  flags: number[],
  blockedTiles: ReadonlySet<string> | undefined,
): number {
  let prevX = session.startX;
  let prevY = session.startY;

  for (let i = 0; i < session.waypoints.length; i++) {
    const wp = session.waypoints[i];
    const path = runAstar(
      prevX, prevY, wp.x, wp.y,
      data, mapWidth, mapHeight, flags,
      session.allowDiagonal, 400, blockedTiles,
    );
    // 경로 위 타일 집합에 클릭 위치가 있으면 해당 구간에 삽입
    // (시작점과 끝점은 제외 — 드래그 대상이므로)
    for (let j = 1; j < path.length - 1; j++) {
      if (path[j].x === clickX && path[j].y === clickY) {
        return i; // i번째 WP 앞에 삽입
      }
    }
    prevX = wp.x;
    prevY = wp.y;
  }

  return -1;
}

function buildBlockedTiles(session: WaypointSession, events: any[] | null): Set<string> | undefined {
  if (!session.avoidEvents || !events) return undefined;
  const s = new Set<string>();
  for (const ev of events) {
    if (ev && ev.id !== session.eventId) {
      s.add(`${ev.x},${ev.y}`);
    }
  }
  return s;
}

export function emitWaypointUpdated() {
  window.dispatchEvent(new CustomEvent('editor-waypoint-updated'));
}

export function emitWaypointSessionChange() {
  window.dispatchEvent(new CustomEvent('editor-waypoint-session-change'));
}

export function useWaypointMode(webglCanvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const editMode = useEditorStore(s => s.editMode);
  const draggingIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const canvas = webglCanvasRef.current;
    if (!canvas || editMode !== 'event') return;

    const onMouseDown = (e: MouseEvent) => {
      const session = (window as any)._editorWaypointSession as WaypointSession | null;
      if (!session) return;

      const tile = canvasToTile(e, canvas);
      if (!tile) return;

      // 기존 웨이포인트 위 → 드래그
      const existing = findWaypointAt(session, tile.x, tile.y);
      if (existing) {
        draggingIdRef.current = existing.id;
        e.stopPropagation();
        return;
      }

      // 시작 위치 클릭 → 무시
      if (tile.x === session.startX && tile.y === session.startY) {
        e.stopPropagation();
        return;
      }

      const state = useEditorStore.getState();
      const currentMap = state.currentMap;
      const tilesetInfo = state.tilesetInfo;
      const events = currentMap?.events ?? null;

      const newWp: WaypointPos = { id: crypto.randomUUID(), x: tile.x, y: tile.y };

      if (currentMap && tilesetInfo) {
        const blocked = buildBlockedTiles(session, events);

        // A* 경로 선분 위인지 확인 → 중간 삽입
        const segIdx = findSegmentIndex(
          session, tile.x, tile.y,
          currentMap.data, currentMap.width, currentMap.height,
          tilesetInfo.flags, blocked,
        );

        if (segIdx >= 0) {
          session.waypoints.splice(segIdx, 0, newWp);
        } else {
          session.waypoints.push(newWp);
        }
      } else {
        session.waypoints.push(newWp);
      }

      emitWaypointUpdated();
      e.stopPropagation();
    };

    const onMouseMove = (e: MouseEvent) => {
      const draggingId = draggingIdRef.current;
      if (!draggingId) return;

      const session = (window as any)._editorWaypointSession as WaypointSession | null;
      if (!session) return;

      const tile = canvasToTile(e, canvas);
      if (!tile) return;

      const wp = session.waypoints.find(w => w.id === draggingId);
      if (wp) {
        wp.x = tile.x;
        wp.y = tile.y;
        emitWaypointUpdated();
      }

      e.stopPropagation();
    };

    const onMouseUp = () => {
      draggingIdRef.current = null;
    };

    // capture=true: React 이벤트보다 먼저 실행되어 이벤트 선택 등을 차단
    canvas.addEventListener('mousedown', onMouseDown, true);
    canvas.addEventListener('mousemove', onMouseMove, true);
    canvas.addEventListener('mouseup', onMouseUp, true);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown, true);
      canvas.removeEventListener('mousemove', onMouseMove, true);
      canvas.removeEventListener('mouseup', onMouseUp, true);
    };
  }, [webglCanvasRef, editMode]);
}
