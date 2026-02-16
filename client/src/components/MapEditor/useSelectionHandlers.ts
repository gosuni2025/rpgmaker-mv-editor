import React, { useRef, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { MapToolsResult } from './useMapTools';

export interface SelectionHandlersResult {
  handleSelectionMouseDown: (tile: { x: number; y: number }) => boolean;
  handleSelectionMouseMove: (tile: { x: number; y: number } | null) => boolean;
  handleSelectionMouseUp: (tile: { x: number; y: number } | null, e: React.MouseEvent<HTMLElement>, canvasToTile: MapToolsResult['canvasToTile']) => boolean;
  handleSelectionMouseLeave: () => boolean;
}

export function useSelectionHandlers(): SelectionHandlersResult {
  const setSelection = useEditorStore((s) => s.setSelection);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const copyTiles = useEditorStore((s) => s.copyTiles);
  const pasteTiles = useEditorStore((s) => s.pasteTiles);
  const moveTiles = useEditorStore((s) => s.moveTiles);
  const setIsPasting = useEditorStore((s) => s.setIsPasting);
  const setPastePreviewPos = useEditorStore((s) => s.setPastePreviewPos);
  const updateMapTiles = useEditorStore((s) => s.updateMapTiles);

  // Selection tool state
  const isSelecting = useRef(false);
  const selectionDragStart = useRef<{ x: number; y: number } | null>(null);
  const isMovingSelection = useRef(false);
  const moveOriginRef = useRef<{ x: number; y: number } | null>(null);
  const originalSelectionBounds = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);

  const handleSelectionMouseDown = useCallback((tile: { x: number; y: number }): boolean => {
    const state = useEditorStore.getState();

    // 붙여넣기 모드: 클릭으로 배치
    if (state.isPasting) {
      pasteTiles(tile.x, tile.y);
      setIsPasting(false);
      setPastePreviewPos(null);
      const cb = state.clipboard;
      if (cb?.type === 'tiles' && cb.width && cb.height) {
        setSelection({ x: tile.x, y: tile.y }, { x: tile.x + cb.width - 1, y: tile.y + cb.height - 1 });
      }
      return true;
    }

    // 기존 선택 영역 내부 클릭: 이동 시작
    if (state.selectionStart && state.selectionEnd) {
      const minX = Math.min(state.selectionStart.x, state.selectionEnd.x);
      const maxX = Math.max(state.selectionStart.x, state.selectionEnd.x);
      const minY = Math.min(state.selectionStart.y, state.selectionEnd.y);
      const maxY = Math.max(state.selectionStart.y, state.selectionEnd.y);

      if (tile.x >= minX && tile.x <= maxX && tile.y >= minY && tile.y <= maxY) {
        isMovingSelection.current = true;
        moveOriginRef.current = { x: tile.x, y: tile.y };
        originalSelectionBounds.current = { minX, minY, maxX, maxY };
        copyTiles(minX, minY, maxX, maxY);
        const latestMap = useEditorStore.getState().currentMap;
        if (latestMap) {
          const clearChanges: { x: number; y: number; z: number; tileId: number }[] = [];
          for (let z = 0; z < 5; z++) {
            for (let y = minY; y <= maxY; y++) {
              for (let x = minX; x <= maxX; x++) {
                const idx = (z * latestMap.height + y) * latestMap.width + x;
                if (latestMap.data[idx] !== 0) {
                  clearChanges.push({ x, y, z, tileId: 0 });
                }
              }
            }
          }
          if (clearChanges.length > 0) updateMapTiles(clearChanges);
        }
        setIsPasting(true);
        setPastePreviewPos({ x: minX, y: minY });
        return true;
      }
    }

    // 새 선택 영역 시작
    clearSelection();
    isSelecting.current = true;
    selectionDragStart.current = tile;
    setSelection(tile, tile);
    return true;
  }, [pasteTiles, setIsPasting, setPastePreviewPos, setSelection, clearSelection, copyTiles, updateMapTiles]);

  const handleSelectionMouseMove = useCallback((tile: { x: number; y: number } | null): boolean => {
    const state = useEditorStore.getState();

    // 선택 영역 이동
    if (isMovingSelection.current && tile && moveOriginRef.current && originalSelectionBounds.current) {
      const dx = tile.x - moveOriginRef.current.x;
      const dy = tile.y - moveOriginRef.current.y;
      const ob = originalSelectionBounds.current;
      setSelection(
        { x: ob.minX + dx, y: ob.minY + dy },
        { x: ob.maxX + dx, y: ob.maxY + dy }
      );
      setPastePreviewPos({ x: ob.minX + dx, y: ob.minY + dy });
      return true;
    }

    // 붙여넣기 프리뷰 이동
    if (state.isPasting && tile) {
      setPastePreviewPos(tile);
      return true;
    }

    // 선택 영역 드래그
    if (isSelecting.current && tile && selectionDragStart.current) {
      setSelection(selectionDragStart.current, tile);
      return true;
    }

    return false;
  }, [setSelection, setPastePreviewPos]);

  const handleSelectionMouseUp = useCallback((tile: { x: number; y: number } | null, e: React.MouseEvent<HTMLElement>, canvasToTile: MapToolsResult['canvasToTile']): boolean => {
    if (isSelecting.current) {
      isSelecting.current = false;
      const start = selectionDragStart.current;
      const t = canvasToTile(e);
      selectionDragStart.current = null;
      if (start && t && start.x === t.x && start.y === t.y) {
        clearSelection();
      }
      return true;
    }

    if (isMovingSelection.current) {
      const t = canvasToTile(e);
      const ob = originalSelectionBounds.current;
      if (t && ob && moveOriginRef.current) {
        const dx = t.x - moveOriginRef.current.x;
        const dy = t.y - moveOriginRef.current.y;
        moveTiles(ob.minX, ob.minY, ob.maxX, ob.maxY, ob.minX + dx, ob.minY + dy);
        setSelection(
          { x: ob.minX + dx, y: ob.minY + dy },
          { x: ob.maxX + dx, y: ob.maxY + dy }
        );
      }
      setIsPasting(false);
      setPastePreviewPos(null);
      isMovingSelection.current = false;
      moveOriginRef.current = null;
      originalSelectionBounds.current = null;
      return true;
    }

    return false;
  }, [clearSelection, moveTiles, setSelection, setIsPasting, setPastePreviewPos]);

  const handleSelectionMouseLeave = useCallback((): boolean => {
    if (isSelecting.current) {
      isSelecting.current = false;
      selectionDragStart.current = null;
      return true;
    }
    if (isMovingSelection.current) {
      const ob = originalSelectionBounds.current;
      const cb = useEditorStore.getState().clipboard;
      if (ob && cb?.type === 'tiles' && cb.tiles) {
        const restoreChanges: { x: number; y: number; z: number; tileId: number }[] = [];
        for (const t of cb.tiles) {
          const tx = ob.minX + t.x, ty = ob.minY + t.y;
          restoreChanges.push({ x: tx, y: ty, z: t.z, tileId: t.tileId });
        }
        updateMapTiles(restoreChanges);
        setSelection({ x: ob.minX, y: ob.minY }, { x: ob.maxX, y: ob.maxY });
      }
      setIsPasting(false);
      setPastePreviewPos(null);
      isMovingSelection.current = false;
      moveOriginRef.current = null;
      originalSelectionBounds.current = null;
      return true;
    }
    return false;
  }, [updateMapTiles, setIsPasting, setPastePreviewPos, setSelection]);

  return {
    handleSelectionMouseDown, handleSelectionMouseMove,
    handleSelectionMouseUp, handleSelectionMouseLeave,
  };
}
