/**
 * useWaypointMode — 웨이포인트 편집 모드 마우스 처리
 *
 * 이벤트 모드에서 window._editorWaypointSession이 있을 때:
 * - 캔버스 클릭: 웨이포인트 추가 (기존 이벤트 선택 차단)
 * - 웨이포인트 위 클릭: 드래그 시작
 * - 드래그: 웨이포인트 위치 업데이트
 */

import React from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import type { WaypointSession, WaypointPos } from '../../utils/astar';

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

      const existing = findWaypointAt(session, tile.x, tile.y);
      if (existing) {
        // 기존 웨이포인트 위 — 드래그 시작
        draggingIdRef.current = existing.id;
      } else {
        // 빈 공간 — 새 웨이포인트 추가
        const newWp: WaypointPos = {
          id: crypto.randomUUID(),
          x: tile.x,
          y: tile.y,
        };
        session.waypoints.push(newWp);
        emitWaypointUpdated();
      }

      // 이벤트 선택 등 기존 핸들러 차단
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
