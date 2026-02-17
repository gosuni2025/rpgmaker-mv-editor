import React, { useRef, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';

export interface ObjectHandlersResult {
  isDraggingObject: React.MutableRefObject<boolean>;
  draggedObjectId: React.MutableRefObject<number | null>;
  isSelectingObjects: React.MutableRefObject<boolean>;
  isPaintingObject: React.MutableRefObject<boolean>;
  objectDragPreview: { x: number; y: number } | null;
  objectMultiDragDelta: { dx: number; dy: number } | null;
  handleObjectMouseDown: (tile: { x: number; y: number }, e: React.MouseEvent<HTMLElement>) => boolean;
  handleObjectMouseMove: (tile: { x: number; y: number } | null) => boolean;
  handleObjectMouseUp: (tile: { x: number; y: number } | null, e: React.MouseEvent<HTMLElement>) => boolean;
  handleObjectMouseLeave: () => void;
  handleObjectPastePreview: (tile: { x: number; y: number }) => boolean;
}

export function useObjectHandlers(): ObjectHandlersResult {
  const currentMap = useEditorStore((s) => s.currentMap);
  const setSelectedObjectId = useEditorStore((s) => s.setSelectedObjectId);
  const addObject = useEditorStore((s) => s.addObject);
  const selectedObjectIds = useEditorStore((s) => s.selectedObjectIds);
  const setSelectedObjectIds = useEditorStore((s) => s.setSelectedObjectIds);
  const setObjectSelectionStart = useEditorStore((s) => s.setObjectSelectionStart);
  const setObjectSelectionEnd = useEditorStore((s) => s.setObjectSelectionEnd);
  const moveObjects = useEditorStore((s) => s.moveObjects);
  const setIsObjectPasting = useEditorStore((s) => s.setIsObjectPasting);
  const setObjectPastePreviewPos = useEditorStore((s) => s.setObjectPastePreviewPos);
  const pasteObjects = useEditorStore((s) => s.pasteObjects);
  const addObjectFromTiles = useEditorStore((s) => s.addObjectFromTiles);
  const expandObjectTiles = useEditorStore((s) => s.expandObjectTiles);
  const shrinkObjectTiles = useEditorStore((s) => s.shrinkObjectTiles);
  const setObjectPaintTiles = useEditorStore((s) => s.setObjectPaintTiles);
  const objectSubMode = useEditorStore((s) => s.objectSubMode);

  // Object paint state
  const isPaintingObject = useRef(false);
  const paintModeRef = useRef<'add' | 'remove'>('add'); // 'add'=새 오브젝트/확장, 'remove'=축소
  const paintTargetIdRef = useRef<number | null>(null); // expand/shrink 대상 오브젝트 ID
  const paintedTilesRef = useRef<Set<string>>(new Set());
  const lastPaintTile = useRef<{ x: number; y: number } | null>(null);

  // Object drag state
  const isDraggingObject = useRef(false);
  const draggedObjectId = useRef<number | null>(null);
  const dragObjectOrigin = useRef<{ x: number; y: number } | null>(null);
  const [objectDragPreview, setObjectDragPreview] = useState<{ x: number; y: number } | null>(null);

  // Object multi-select drag state
  const isSelectingObjects = useRef(false);
  const objectSelDragStart = useRef<{ x: number; y: number } | null>(null);
  // Object multi-drag state
  const isDraggingMultiObjects = useRef(false);
  const multiObjectDragOrigin = useRef<{ x: number; y: number } | null>(null);
  const [objectMultiDragDelta, setObjectMultiDragDelta] = useState<{ dx: number; dy: number } | null>(null);

  const handleObjectMouseDown = useCallback((tile: { x: number; y: number }, e: React.MouseEvent<HTMLElement>): boolean => {
    const state = useEditorStore.getState();

    // 붙여넣기 모드
    if (state.isObjectPasting) {
      pasteObjects(tile.x, tile.y);
      setIsObjectPasting(false);
      setObjectPastePreviewPos(null);
      return true;
    }

    const objects = currentMap?.objects || [];
    // tileIds 기반 hit 판정 (0인 빈 타일은 히트하지 않음, 이미지 오브젝트는 전체 영역 히트)
    const hitObj = objects.find(o => {
      if (tile.x < o.x || tile.x >= o.x + o.width) return false;
      const topY = o.y - o.height + 1;
      if (tile.y < topY || tile.y > o.y) return false;
      // 이미지/애니메이션 오브젝트는 전체 영역이 히트
      if (o.imageName || o.animationId) return true;
      // tileIds가 있으면 해당 셀이 0이 아닌지 확인
      if (o.tileIds) {
        const row = tile.y - topY, col = tile.x - o.x;
        const cell = o.tileIds[row]?.[col];
        return Array.isArray(cell) ? cell.some(t => t !== 0) : (cell !== 0 && cell != null);
      }
      return true;
    });

    // Alt+드래그: 선택된 오브젝트에서 타일 제거
    if (e.altKey && state.selectedObjectIds.length === 1) {
      const targetId = state.selectedObjectIds[0];
      const targetObj = objects.find(o => o.id === targetId);
      if (targetObj) {
        isPaintingObject.current = true;
        paintModeRef.current = 'remove';
        paintTargetIdRef.current = targetId;
        paintedTilesRef.current = new Set([`${tile.x},${tile.y}`]);
        lastPaintTile.current = { x: tile.x, y: tile.y };
        setObjectPaintTiles(new Set([`${tile.x},${tile.y}`]));
        return true;
      }
    }

    if (hitObj) {
      const curIds = state.selectedObjectIds;
      if (e.metaKey || e.ctrlKey) {
        if (curIds.includes(hitObj.id)) {
          const newIds = curIds.filter(id => id !== hitObj.id);
          setSelectedObjectIds(newIds);
          setSelectedObjectId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
        } else {
          const newIds = [...curIds, hitObj.id];
          setSelectedObjectIds(newIds);
          setSelectedObjectId(hitObj.id);
        }
      } else if (curIds.includes(hitObj.id)) {
        isDraggingMultiObjects.current = true;
        multiObjectDragOrigin.current = { x: tile.x, y: tile.y };
        setObjectMultiDragDelta(null);
      } else {
        setSelectedObjectIds([hitObj.id]);
        setSelectedObjectId(hitObj.id);
        isDraggingObject.current = true;
        draggedObjectId.current = hitObj.id;
        dragObjectOrigin.current = { x: tile.x, y: tile.y };
        setObjectDragPreview(null);
      }
    } else {
      const hadSelection = state.selectedObjectIds.length > 0;
      const subMode = state.objectSubMode;

      if (subMode === 'select' || e.shiftKey) {
        // 선택 모드 또는 Shift+클릭: 영역 선택
        if (!(e.metaKey || e.ctrlKey)) {
          setSelectedObjectIds([]);
          setSelectedObjectId(null);
          // 선택된 항목이 있었으면 선택 해제만 하고 영역선택 진입하지 않음
          if (hadSelection) {
            return true;
          }
        }
        isSelectingObjects.current = true;
        objectSelDragStart.current = tile;
        setObjectSelectionStart(tile);
        setObjectSelectionEnd(tile);
      } else {
        // 생성 모드 + 빈 공간 클릭: 선택된 항목이 있었으면 선택 해제만
        if (hadSelection) {
          setSelectedObjectIds([]);
          setSelectedObjectId(null);
          return true;
        }
        // 빈 공간 클릭: 펜 칠하기 시작 (아무것도 선택되지 않은 상태)
        isPaintingObject.current = true;
        paintModeRef.current = 'add';
        paintTargetIdRef.current = null;
        paintedTilesRef.current = new Set([`${tile.x},${tile.y}`]);
        lastPaintTile.current = { x: tile.x, y: tile.y };
        setObjectPaintTiles(new Set([`${tile.x},${tile.y}`]));
      }
    }
    return true;
  }, [currentMap, objectSubMode, pasteObjects, setIsObjectPasting, setObjectPastePreviewPos, setSelectedObjectId, setSelectedObjectIds, setObjectSelectionStart, setObjectSelectionEnd, setObjectPaintTiles]);

  const handleObjectMouseMove = useCallback((tile: { x: number; y: number } | null): boolean => {
    // Object paint (Bresenham 보간으로 빈틈 없이 칠하기)
    if (isPaintingObject.current && tile) {
      let changed = false;
      const prev = lastPaintTile.current;
      if (prev && (prev.x !== tile.x || prev.y !== tile.y)) {
        // Bresenham line between prev and tile
        let x0 = prev.x, y0 = prev.y;
        const x1 = tile.x, y1 = tile.y;
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        while (true) {
          const k = `${x0},${y0}`;
          if (!paintedTilesRef.current.has(k)) {
            paintedTilesRef.current.add(k);
            changed = true;
          }
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      } else {
        const key = `${tile.x},${tile.y}`;
        if (!paintedTilesRef.current.has(key)) {
          paintedTilesRef.current.add(key);
          changed = true;
        }
      }
      lastPaintTile.current = { x: tile.x, y: tile.y };
      if (changed) setObjectPaintTiles(new Set(paintedTilesRef.current));
      return true;
    }

    // Object multi-drag
    if (isDraggingMultiObjects.current && tile && multiObjectDragOrigin.current) {
      const dx = tile.x - multiObjectDragOrigin.current.x;
      const dy = tile.y - multiObjectDragOrigin.current.y;
      if (dx !== 0 || dy !== 0) {
        setObjectMultiDragDelta({ dx, dy });
      } else {
        setObjectMultiDragDelta(null);
      }
      return true;
    }

    // Object single dragging → convert to multi-drag
    if (isDraggingObject.current && tile && dragObjectOrigin.current) {
      if (tile.x !== dragObjectOrigin.current.x || tile.y !== dragObjectOrigin.current.y) {
        isDraggingObject.current = false;
        isDraggingMultiObjects.current = true;
        multiObjectDragOrigin.current = dragObjectOrigin.current;
        dragObjectOrigin.current = null;
        const dx = tile.x - multiObjectDragOrigin.current!.x;
        const dy = tile.y - multiObjectDragOrigin.current!.y;
        setObjectMultiDragDelta({ dx, dy });
        setObjectDragPreview(null);
      }
      return true;
    }

    // Object area selection drag
    if (isSelectingObjects.current && tile && objectSelDragStart.current) {
      setObjectSelectionEnd(tile);
      return true;
    }

    return false;
  }, [setObjectSelectionEnd, setObjectPaintTiles]);

  const handleObjectPastePreview = useCallback((tile: { x: number; y: number }): boolean => {
    const state = useEditorStore.getState();
    if (state.isObjectPasting) {
      setObjectPastePreviewPos(tile);
      return true;
    }
    return false;
  }, [setObjectPastePreviewPos]);

  const handleObjectMouseUp = useCallback((tile: { x: number; y: number } | null, e: React.MouseEvent<HTMLElement>): boolean => {
    // Object multi-drag commit
    if (isDraggingMultiObjects.current) {
      if (tile && multiObjectDragOrigin.current) {
        const dx = tile.x - multiObjectDragOrigin.current.x;
        const dy = tile.y - multiObjectDragOrigin.current.y;
        const state = useEditorStore.getState();
        if (dx !== 0 || dy !== 0) {
          moveObjects(state.selectedObjectIds, dx, dy);
        }
      }
      isDraggingMultiObjects.current = false;
      multiObjectDragOrigin.current = null;
      setObjectMultiDragDelta(null);
      return true;
    }

    // Object single drag (mouseUp without move)
    if (isDraggingObject.current && draggedObjectId.current != null) {
      isDraggingObject.current = false;
      draggedObjectId.current = null;
      dragObjectOrigin.current = null;
      setObjectDragPreview(null);
      return true;
    }

    // Object paint commit
    if (isPaintingObject.current) {
      isPaintingObject.current = false;
      lastPaintTile.current = null;
      const painted = paintedTilesRef.current;
      const mode = paintModeRef.current;
      const targetId = paintTargetIdRef.current;
      paintedTilesRef.current = new Set();
      paintTargetIdRef.current = null;
      setObjectPaintTiles(null);

      if (mode === 'remove' && targetId != null) {
        // 축소 모드
        if (painted.size > 0) shrinkObjectTiles(targetId, painted);
      } else if (targetId != null) {
        // 확장 모드 (선택된 오브젝트에 추가)
        if (painted.size <= 1 && tile) {
          // 단일 클릭도 확장으로 처리
          expandObjectTiles(targetId, painted.size > 0 ? painted : new Set([`${tile.x},${tile.y}`]));
        } else if (painted.size > 1) {
          expandObjectTiles(targetId, painted);
        }
      } else {
        // 새 오브젝트 생성
        if (painted.size <= 1 && tile) {
          addObject(tile.x, tile.y);
        } else if (painted.size > 1) {
          addObjectFromTiles(painted);
        }
      }
      return true;
    }

    // Object area selection commit
    if (isSelectingObjects.current) {
      isSelectingObjects.current = false;
      const start = objectSelDragStart.current;
      objectSelDragStart.current = null;

      if (start && tile && start.x === tile.x && start.y === tile.y) {
        // 단일 클릭: select 모드에서는 선택 해제만, create 모드에서는 오브젝트 생성
        const subMode = useEditorStore.getState().objectSubMode;
        if (subMode === 'create') {
          addObject(tile.x, tile.y);
        }
        setObjectSelectionStart(null);
        setObjectSelectionEnd(null);
      } else if (start && tile && currentMap?.objects) {
        const minX = Math.min(start.x, tile.x);
        const maxX = Math.max(start.x, tile.x);
        const minY = Math.min(start.y, tile.y);
        const maxY = Math.max(start.y, tile.y);
        const objectsInArea = currentMap.objects
          .filter(o => {
            const oMinX = o.x;
            const oMaxX = o.x + o.width - 1;
            const oMinY = o.y - o.height + 1;
            const oMaxY = o.y;
            return oMinX <= maxX && oMaxX >= minX && oMinY <= maxY && oMaxY >= minY;
          })
          .map(o => o.id);
        if (e.metaKey || e.ctrlKey) {
          const curIds = useEditorStore.getState().selectedObjectIds;
          const merged = [...new Set([...curIds, ...objectsInArea])];
          setSelectedObjectIds(merged);
          if (merged.length > 0) setSelectedObjectId(merged[merged.length - 1]);
        } else {
          setSelectedObjectIds(objectsInArea);
          if (objectsInArea.length > 0) setSelectedObjectId(objectsInArea[0]);
          else setSelectedObjectId(null);
        }
        setObjectSelectionStart(null);
        setObjectSelectionEnd(null);
      }
      return true;
    }

    return false;
  }, [currentMap, addObject, addObjectFromTiles, expandObjectTiles, shrinkObjectTiles, moveObjects, setSelectedObjectId, setSelectedObjectIds, setObjectSelectionStart, setObjectSelectionEnd, setObjectPaintTiles]);

  const handleObjectMouseLeave = useCallback(() => {
    if (isDraggingMultiObjects.current) {
      isDraggingMultiObjects.current = false;
      multiObjectDragOrigin.current = null;
      setObjectMultiDragDelta(null);
    }
    if (isSelectingObjects.current) {
      isSelectingObjects.current = false;
      objectSelDragStart.current = null;
      setObjectSelectionStart(null);
      setObjectSelectionEnd(null);
    }
    if (isPaintingObject.current) {
      isPaintingObject.current = false;
      lastPaintTile.current = null;
      paintTargetIdRef.current = null;
      paintedTilesRef.current = new Set();
      setObjectPaintTiles(null);
    }
  }, [setObjectSelectionStart, setObjectSelectionEnd, setObjectPaintTiles]);

  return {
    isDraggingObject, draggedObjectId, isSelectingObjects, isPaintingObject,
    objectDragPreview, objectMultiDragDelta,
    handleObjectMouseDown, handleObjectMouseMove,
    handleObjectMouseUp, handleObjectMouseLeave,
    handleObjectPastePreview,
  };
}
