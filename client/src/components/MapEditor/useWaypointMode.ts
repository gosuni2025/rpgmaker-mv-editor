/**
 * useWaypointMode — 웨이포인트 편집 모드 마우스 처리
 *
 * 이벤트 모드에서 window._editorWaypointSession이 있을 때:
 * - 웨이포인트 마커 위 클릭: 드래그 시작
 * - A* 경로 선분 위 클릭: 해당 구간에 웨이포인트 삽입
 * - 그 외 빈 공간 클릭: 마지막에 추가
 * - 드래그: 웨이포인트 위치 업데이트
 * - Cmd+Z / Ctrl+Z: undo
 * - Cmd+Shift+Z / Ctrl+Shift+Z: redo
 */

import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import type { WaypointSession, WaypointPos } from '../../utils/astar';
import { runAstar } from '../../utils/astar';

// ===================================================================
// 히스토리
// ===================================================================

/** 변경 전 현재 waypoints 상태를 히스토리에 저장 */
export function pushWaypointHistory(session: WaypointSession) {
  if (!session._history) {
    session._history = [];
    session._historyIdx = -1;
  }
  // 현재 인덱스 이후의 redo 스택 제거
  const idx = session._historyIdx ?? -1;
  session._history = session._history.slice(0, idx + 1);
  session._history.push(session.waypoints.map(wp => ({ ...wp })));
  session._historyIdx = session._history.length - 1;
}

function undoWaypoint() {
  const session = (window as any)._editorWaypointSession as WaypointSession | null;
  if (!session?._history || session._historyIdx == null) return;
  if (session._historyIdx <= 0) return;

  session._historyIdx--;
  session.waypoints = session._history[session._historyIdx].map(wp => ({ ...wp }));
  emitWaypointUpdated();
}

function redoWaypoint() {
  const session = (window as any)._editorWaypointSession as WaypointSession | null;
  if (!session?._history || session._historyIdx == null) return;
  if (session._historyIdx >= session._history.length - 1) return;

  session._historyIdx++;
  session.waypoints = session._history[session._historyIdx].map(wp => ({ ...wp }));
  emitWaypointUpdated();
}

// ===================================================================
// 유틸
// ===================================================================

function canvasToTile(
  e: MouseEvent,
  canvas: HTMLCanvasElement,
  zoomLevel: number,
): { x: number; y: number } | null {
  // useMapTools.ts의 getScreenPos와 동일한 방식:
  // canvas 부모 컨테이너 기준 + zoomLevel 보정
  const container = canvas.parentElement;
  if (!container) return null;
  const rect = container.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const cx = (e.clientX - rect.left) / zoomLevel;
  const cy = (e.clientY - rect.top) / zoomLevel;
  return {
    x: Math.floor(cx / TILE_SIZE_PX),
    y: Math.floor(cy / TILE_SIZE_PX),
  };
}

function findWaypointAt(session: WaypointSession, tx: number, ty: number): WaypointPos | null {
  return session.waypoints.find(wp => wp.x === tx && wp.y === ty) ?? null;
}

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
      session.allowDiagonal, 400, blockedTiles, session.ignorePassability,
    );
    for (let j = 1; j < path.length - 1; j++) {
      if (path[j].x === clickX && path[j].y === clickY) return i;
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
    if (ev && ev.id !== session.eventId) s.add(`${ev.x},${ev.y}`);
  }
  return s;
}

// ===================================================================
// 공개 이벤트 헬퍼
// ===================================================================

export function emitWaypointUpdated() {
  window.dispatchEvent(new CustomEvent('editor-waypoint-updated'));
}

export function emitWaypointSessionChange() {
  window.dispatchEvent(new CustomEvent('editor-waypoint-session-change'));
}

// ===================================================================
// 훅
// ===================================================================

export function useWaypointMode(webglCanvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const editMode = useEditorStore(s => s.editMode);
  const zoomLevel = useEditorStore(s => s.zoomLevel);
  const draggingIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const canvas = webglCanvasRef.current;
    if (!canvas || editMode !== 'event') return;

    // ── 키보드: Cmd+Z / Cmd+Shift+Z ──────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      const session = (window as any)._editorWaypointSession as WaypointSession | null;
      if (!session) return;

      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        undoWaypoint();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        e.stopPropagation();
        redoWaypoint();
      }
    };

    // capture=true로 에디터 전역 Cmd+Z보다 먼저 처리
    window.addEventListener('keydown', onKeyDown, true);

    // ── 마우스 ────────────────────────────────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // 좌클릭만 처리 (휠·우클릭은 맵 패닝에 양보)
      const session = (window as any)._editorWaypointSession as WaypointSession | null;
      if (!session) return;

      const tile = canvasToTile(e, canvas, zoomLevel);
      if (!tile) return;

      const existing = findWaypointAt(session, tile.x, tile.y);
      if (existing) {
        // 드래그 시작 전 스냅샷 저장
        pushWaypointHistory(session);
        draggingIdRef.current = existing.id;
        e.stopPropagation();
        return;
      }

      if (tile.x === session.startX && tile.y === session.startY) {
        e.stopPropagation();
        return;
      }

      const state = useEditorStore.getState();
      const currentMap = state.currentMap;
      const tilesetInfo = state.tilesetInfo;
      const events = currentMap?.events ?? null;

      const newWp: WaypointPos = { id: crypto.randomUUID(), x: tile.x, y: tile.y };

      // 변경 전 스냅샷 저장
      pushWaypointHistory(session);

      if (currentMap && tilesetInfo) {
        const blocked = buildBlockedTiles(session, events);
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

      const tile = canvasToTile(e, canvas, zoomLevel);
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

    canvas.addEventListener('mousedown', onMouseDown, true);
    canvas.addEventListener('mousemove', onMouseMove, true);
    canvas.addEventListener('mouseup', onMouseUp, true);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      canvas.removeEventListener('mousedown', onMouseDown, true);
      canvas.removeEventListener('mousemove', onMouseMove, true);
      canvas.removeEventListener('mouseup', onMouseUp, true);
    };
  }, [webglCanvasRef, editMode, zoomLevel]);
}
