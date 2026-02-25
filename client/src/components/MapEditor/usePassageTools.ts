import { useRef, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { PassageChange } from '../../store/types';

function isInsideSelection(
  tile: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): boolean {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  return tile.x >= minX && tile.x <= maxX && tile.y >= minY && tile.y <= maxY;
}

export function usePassageHandlers(
  canvasToTile: (e: React.MouseEvent<HTMLElement>, unclamped?: boolean) => { x: number; y: number } | null,
) {
  const isDrawing = useRef(false);
  const lastTile = useRef<{ x: number; y: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const pendingChanges = useRef<PassageChange[]>([]);

  // Select 모드용 refs
  const isSelectDragging = useRef(false); // 드래그 선택 중
  const isMoving = useRef(false); // 선택 영역 이동 중
  const moveOrigin = useRef<{ x: number; y: number } | null>(null); // 이동 시작 시 원본 선택 좌상단
  const selectDragStart = useRef<{ x: number; y: number } | null>(null);

  const getPassageValue = useCallback((x: number, y: number): number => {
    const map = useEditorStore.getState().currentMap;
    if (!map) return 0;
    const cp = map.customPassage;
    if (!cp) return 0;
    return cp[y * map.width + x] || 0;
  }, []);

  const applyPassage = useCallback((x: number, y: number, value: number) => {
    const map = useEditorStore.getState().currentMap;
    if (!map || x < 0 || x >= map.width || y < 0 || y >= map.height) return;
    const oldValue = getPassageValue(x, y);
    if (oldValue === value) return;
    pendingChanges.current.push({ x, y, oldValue, newValue: value });
    // Immediately update map for visual feedback
    const cp = map.customPassage ? [...map.customPassage] : new Array(map.width * map.height).fill(0);
    cp[y * map.width + x] = value;
    useEditorStore.setState({ currentMap: { ...map, customPassage: cp } });
  }, [getPassageValue]);

  const applyToTile = useCallback((x: number, y: number) => {
    const { passageTool } = useEditorStore.getState();
    if (passageTool === 'pen') {
      applyPassage(x, y, 0x0F); // 전방향 차단
    } else if (passageTool === 'forceOpen') {
      applyPassage(x, y, 0xF0); // 전방향 강제 개방
    } else {
      applyPassage(x, y, 0); // 커스텀 제거
    }
  }, [applyPassage]);

  const floodFill = useCallback((startX: number, startY: number) => {
    const map = useEditorStore.getState().currentMap;
    if (!map) return;
    const { passageTool } = useEditorStore.getState();
    const targetValue = getPassageValue(startX, startY);
    const newValue = passageTool === 'pen' ? 0x0F : passageTool === 'forceOpen' ? 0xF0 : 0;
    if (targetValue === newValue) return;

    const w = map.width;
    const h = map.height;
    const visited = new Set<string>();
    const queue: { x: number; y: number }[] = [{ x: startX, y: startY }];

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      if (getPassageValue(x, y) !== targetValue) continue;
      visited.add(key);
      applyPassage(x, y, newValue);
      queue.push({ x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 });
    }
  }, [getPassageValue, applyPassage]);

  const applyArea = useCallback((x1: number, y1: number, x2: number, y2: number, shape: 'rectangle' | 'ellipse') => {
    const map = useEditorStore.getState().currentMap;
    if (!map) return;
    const { passageTool } = useEditorStore.getState();
    const newValue = passageTool === 'pen' ? 0x0F : passageTool === 'forceOpen' ? 0xF0 : 0;
    const minX = Math.max(0, Math.min(x1, x2));
    const maxX = Math.min(map.width - 1, Math.max(x1, x2));
    const minY = Math.max(0, Math.min(y1, y2));
    const maxY = Math.min(map.height - 1, Math.max(y1, y2));

    if (shape === 'rectangle') {
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          applyPassage(x, y, newValue);
        }
      }
    } else {
      // Ellipse
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const rx = (maxX - minX) / 2 + 0.5;
      const ry = (maxY - minY) / 2 + 0.5;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1) {
            applyPassage(x, y, newValue);
          }
        }
      }
    }
  }, [applyPassage]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (e.button !== 0) return false;
    const tile = canvasToTile(e);
    if (!tile) return false;
    const { passageTool, passageShape, isPassagePasting, passageSelectionStart, passageSelectionEnd } = useEditorStore.getState();

    // 선택된 타일 업데이트 (인스펙터용)
    useEditorStore.getState().setSelectedPassageTile(tile);

    // 선택 모드
    if (passageTool === 'select') {
      // 붙여넣기 모드 → 클릭으로 배치
      if (isPassagePasting) {
        const { clipboard } = useEditorStore.getState();
        if (clipboard?.type === 'passage' && clipboard.width && clipboard.height) {
          useEditorStore.getState().pastePassage(tile.x, tile.y);
          useEditorStore.getState().setPassageSelection(
            { x: tile.x, y: tile.y },
            { x: tile.x + clipboard.width - 1, y: tile.y + clipboard.height - 1 },
          );
          useEditorStore.getState().setIsPassagePasting(false);
          useEditorStore.getState().setPassagePastePreviewPos(null);
          useEditorStore.getState().showToast('통행 데이터 붙여넣기 완료');
        }
        return true;
      }

      // 기존 선택 영역 내부 클릭 → 이동 시작
      if (passageSelectionStart && passageSelectionEnd && isInsideSelection(tile, passageSelectionStart, passageSelectionEnd)) {
        isMoving.current = true;
        const minX = Math.min(passageSelectionStart.x, passageSelectionEnd.x);
        const minY = Math.min(passageSelectionStart.y, passageSelectionEnd.y);
        moveOrigin.current = { x: minX, y: minY };
        selectDragStart.current = tile;
        // 이동 시작 시 클립보드에 원본 데이터를 복사해둠
        useEditorStore.getState().copyPassage(
          passageSelectionStart.x, passageSelectionStart.y,
          passageSelectionEnd.x, passageSelectionEnd.y,
        );
        return true;
      }

      // 새 드래그 선택 시작
      isSelectDragging.current = true;
      selectDragStart.current = tile;
      useEditorStore.getState().setPassageSelection(tile, tile);
      return true;
    }

    // 그리기 모드 (pen/eraser)
    isDrawing.current = true;
    lastTile.current = tile;
    pendingChanges.current = [];

    if (passageShape === 'fill') {
      floodFill(tile.x, tile.y);
      isDrawing.current = false;
      // 즉시 commit
      if (pendingChanges.current.length > 0) {
        useEditorStore.getState().updateCustomPassage(pendingChanges.current);
        pendingChanges.current = [];
      }
    } else if (passageShape === 'rectangle' || passageShape === 'ellipse') {
      dragStart.current = tile;
    } else {
      applyToTile(tile.x, tile.y);
    }
    return true;
  }, [canvasToTile, applyToTile, floodFill]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const tile = canvasToTile(e);
    const { passageTool, isPassagePasting } = useEditorStore.getState();

    // 붙여넣기 프리뷰 이동
    if (passageTool === 'select' && isPassagePasting && tile) {
      useEditorStore.getState().setPassagePastePreviewPos(tile);
      return true;
    }

    // 선택 영역 이동 중
    if (isMoving.current && tile && selectDragStart.current) {
      const dx = tile.x - selectDragStart.current.x;
      const dy = tile.y - selectDragStart.current.y;
      if (dx === 0 && dy === 0) return true;
      const { passageSelectionStart, passageSelectionEnd } = useEditorStore.getState();
      if (passageSelectionStart && passageSelectionEnd) {
        const w = Math.abs(passageSelectionEnd.x - passageSelectionStart.x);
        const h = Math.abs(passageSelectionEnd.y - passageSelectionStart.y);
        const newMinX = Math.min(passageSelectionStart.x, passageSelectionEnd.x) + dx;
        const newMinY = Math.min(passageSelectionStart.y, passageSelectionEnd.y) + dy;
        useEditorStore.getState().setPassageSelection(
          { x: newMinX, y: newMinY },
          { x: newMinX + w, y: newMinY + h },
        );
        selectDragStart.current = tile;
      }
      return true;
    }

    // 드래그 선택 중
    if (isSelectDragging.current && tile) {
      useEditorStore.getState().setPassageSelection(
        useEditorStore.getState().passageSelectionStart || tile,
        tile,
      );
      return true;
    }

    // 그리기 모드
    if (!isDrawing.current) return false;
    if (!tile) return false;
    const { passageShape } = useEditorStore.getState();

    if (passageShape === 'rectangle' || passageShape === 'ellipse') {
      return true;
    }

    if (lastTile.current && tile.x === lastTile.current.x && tile.y === lastTile.current.y) return true;
    lastTile.current = tile;

    if (passageShape === 'freehand') {
      applyToTile(tile.x, tile.y);
    }
    return true;
  }, [canvasToTile, applyToTile]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const tile = canvasToTile(e);

    // 이동 종료
    if (isMoving.current) {
      isMoving.current = false;
      if (moveOrigin.current && tile) {
        const { passageSelectionStart, passageSelectionEnd } = useEditorStore.getState();
        if (passageSelectionStart && passageSelectionEnd && moveOrigin.current) {
          const origMinX = moveOrigin.current.x;
          const origMinY = moveOrigin.current.y;
          const { clipboard } = useEditorStore.getState();
          if (clipboard?.type === 'passage' && clipboard.width && clipboard.height) {
            const destX = Math.min(passageSelectionStart.x, passageSelectionEnd.x);
            const destY = Math.min(passageSelectionStart.y, passageSelectionEnd.y);
            if (destX !== origMinX || destY !== origMinY) {
              useEditorStore.getState().movePassage(
                origMinX, origMinY,
                origMinX + clipboard.width - 1, origMinY + clipboard.height - 1,
                destX, destY,
              );
            }
          }
        }
      }
      moveOrigin.current = null;
      selectDragStart.current = null;
      return true;
    }

    // 드래그 선택 종료
    if (isSelectDragging.current) {
      isSelectDragging.current = false;
      // 단일 타일 클릭이든 드래그 선택이든 선택 상태 유지
      selectDragStart.current = null;
      return true;
    }

    // 그리기 모드 종료
    if (!isDrawing.current) return false;
    isDrawing.current = false;
    const { passageShape } = useEditorStore.getState();

    if ((passageShape === 'rectangle' || passageShape === 'ellipse') && dragStart.current && tile) {
      applyArea(dragStart.current.x, dragStart.current.y, tile.x, tile.y, passageShape);
    }

    dragStart.current = null;
    lastTile.current = null;

    if (pendingChanges.current.length > 0) {
      useEditorStore.getState().updateCustomPassage(pendingChanges.current);
      pendingChanges.current = [];
    }
    return true;
  }, [canvasToTile, applyArea]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    isDrawing,
    dragStart,
    isSelectDragging,
    isMoving,
  };
}
