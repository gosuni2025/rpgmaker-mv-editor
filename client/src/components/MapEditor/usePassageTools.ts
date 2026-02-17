import { useRef, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { PassageChange } from '../../store/types';

export function usePassageHandlers(
  canvasToTile: (e: React.MouseEvent<HTMLElement>, unclamped?: boolean) => { x: number; y: number } | null,
) {
  const isDrawing = useRef(false);
  const lastTile = useRef<{ x: number; y: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const pendingChanges = useRef<PassageChange[]>([]);

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
      applyPassage(x, y, 0x0F); // 전방향 불가
    } else {
      applyPassage(x, y, 0); // 제거
    }
  }, [applyPassage]);

  const floodFill = useCallback((startX: number, startY: number) => {
    const map = useEditorStore.getState().currentMap;
    if (!map) return;
    const { passageTool } = useEditorStore.getState();
    const targetValue = getPassageValue(startX, startY);
    const newValue = passageTool === 'pen' ? 0x0F : 0;
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
    const newValue = passageTool === 'pen' ? 0x0F : 0;
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
    const { passageShape } = useEditorStore.getState();

    // 선택된 타일 업데이트 (인스펙터용)
    useEditorStore.getState().setSelectedPassageTile(tile);

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
    if (!isDrawing.current) return false;
    const tile = canvasToTile(e);
    if (!tile) return false;
    const { passageShape } = useEditorStore.getState();

    if (passageShape === 'rectangle' || passageShape === 'ellipse') {
      // 드래그 프리뷰 (오버레이에서 처리)
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
    if (!isDrawing.current) return false;
    isDrawing.current = false;
    const tile = canvasToTile(e);
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
  };
}
