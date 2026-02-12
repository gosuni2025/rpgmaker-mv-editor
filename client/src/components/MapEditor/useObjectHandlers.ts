import React, { useRef, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';

export interface ObjectHandlersResult {
  isDraggingObject: React.MutableRefObject<boolean>;
  draggedObjectId: React.MutableRefObject<number | null>;
  isSelectingObjects: React.MutableRefObject<boolean>;
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
    const hitObj = objects.find(o =>
      tile.x >= o.x && tile.x < o.x + o.width &&
      tile.y >= o.y - o.height + 1 && tile.y <= o.y
    );
    if (hitObj) {
      const curIds = state.selectedObjectIds;
      if (e.shiftKey) {
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
      if (!e.shiftKey) {
        setSelectedObjectIds([]);
        setSelectedObjectId(null);
      }
      isSelectingObjects.current = true;
      objectSelDragStart.current = tile;
      setObjectSelectionStart(tile);
      setObjectSelectionEnd(tile);
    }
    return true;
  }, [currentMap, pasteObjects, setIsObjectPasting, setObjectPastePreviewPos, setSelectedObjectId, setSelectedObjectIds, setObjectSelectionStart, setObjectSelectionEnd]);

  const handleObjectMouseMove = useCallback((tile: { x: number; y: number } | null): boolean => {
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
  }, [setObjectSelectionEnd]);

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

    // Object area selection commit
    if (isSelectingObjects.current) {
      isSelectingObjects.current = false;
      const start = objectSelDragStart.current;
      objectSelDragStart.current = null;

      if (start && tile && start.x === tile.x && start.y === tile.y) {
        addObject(tile.x, tile.y);
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
        if (e.shiftKey) {
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
  }, [currentMap, addObject, moveObjects, setSelectedObjectId, setSelectedObjectIds, setObjectSelectionStart, setObjectSelectionEnd]);

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
  }, [setObjectSelectionStart, setObjectSelectionEnd]);

  return {
    isDraggingObject, draggedObjectId, isSelectingObjects,
    objectDragPreview, objectMultiDragDelta,
    handleObjectMouseDown, handleObjectMouseMove,
    handleObjectMouseUp, handleObjectMouseLeave,
    handleObjectPastePreview,
  };
}
