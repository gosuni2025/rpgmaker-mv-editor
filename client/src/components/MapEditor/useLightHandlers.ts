import React, { useRef, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import type { MapToolsResult } from './useMapTools';

export interface LightHandlersResult {
  isDraggingLight: React.MutableRefObject<boolean>;
  isSelectingLights: React.MutableRefObject<boolean>;
  lightDragPreview: { x: number; y: number } | null;
  lightMultiDragDelta: { dx: number; dy: number } | null;
  handleLightMouseDown: (tile: { x: number; y: number }, e: React.MouseEvent<HTMLElement>) => boolean;
  handleLightMouseMove: (tile: { x: number; y: number } | null) => boolean;
  handleLightMouseUp: (tile: { x: number; y: number } | null, e: React.MouseEvent<HTMLElement>) => boolean;
  handleLightMouseLeave: () => void;
  handleLightPastePreview: (tile: { x: number; y: number }) => boolean;
}

export function useLightHandlers(): LightHandlersResult {
  const currentMap = useEditorStore((s) => s.currentMap);
  const lightEditMode = useEditorStore((s) => s.lightEditMode);
  const selectedLightType = useEditorStore((s) => s.selectedLightType);
  const setSelectedLightId = useEditorStore((s) => s.setSelectedLightId);
  const addPointLight = useEditorStore((s) => s.addPointLight);
  const selectedLightIds = useEditorStore((s) => s.selectedLightIds);
  const setSelectedLightIds = useEditorStore((s) => s.setSelectedLightIds);
  const setLightSelectionStart = useEditorStore((s) => s.setLightSelectionStart);
  const setLightSelectionEnd = useEditorStore((s) => s.setLightSelectionEnd);
  const moveLights = useEditorStore((s) => s.moveLights);
  const isLightPasting = useEditorStore((s) => s.isLightPasting);
  const setIsLightPasting = useEditorStore((s) => s.setIsLightPasting);
  const setLightPastePreviewPos = useEditorStore((s) => s.setLightPastePreviewPos);
  const pasteLights = useEditorStore((s) => s.pasteLights);
  const clearLightSelection = useEditorStore((s) => s.clearLightSelection);

  // Light drag state
  const isDraggingLight = useRef(false);
  const draggedLightId = useRef<number | null>(null);
  const dragLightOrigin = useRef<{ x: number; y: number } | null>(null);
  const [lightDragPreview, setLightDragPreview] = useState<{ x: number; y: number } | null>(null);

  // Light multi-select drag state
  const isSelectingLights = useRef(false);
  const lightSelDragStart = useRef<{ x: number; y: number } | null>(null);
  // Light multi-drag state
  const isDraggingMultiLights = useRef(false);
  const multiLightDragOrigin = useRef<{ x: number; y: number } | null>(null);
  const [lightMultiDragDelta, setLightMultiDragDelta] = useState<{ dx: number; dy: number } | null>(null);

  const handleLightMouseDown = useCallback((tile: { x: number; y: number }, e: React.MouseEvent<HTMLElement>): boolean => {
    const state = useEditorStore.getState();

    // 붙여넣기 모드
    if (state.isLightPasting) {
      pasteLights(tile.x, tile.y);
      setIsLightPasting(false);
      setLightPastePreviewPos(null);
      return true;
    }

    const lights = currentMap?.editorLights?.points || [];
    const hitLight = lights.find(l => {
      if (l.x === tile.x && l.y === tile.y) return true;
      const zOffset = (l.z ?? 0) * 0.5;
      const visualY = l.y * TILE_SIZE_PX + TILE_SIZE_PX / 2 - zOffset;
      const visualTileY = Math.floor(visualY / TILE_SIZE_PX);
      return l.x === tile.x && visualTileY === tile.y;
    });

    if (hitLight) {
      const curIds = state.selectedLightIds;
      if (e.metaKey || e.ctrlKey) {
        if (curIds.includes(hitLight.id)) {
          const newIds = curIds.filter(id => id !== hitLight.id);
          setSelectedLightIds(newIds);
          setSelectedLightId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
        } else {
          const newIds = [...curIds, hitLight.id];
          setSelectedLightIds(newIds);
          setSelectedLightId(hitLight.id);
        }
      } else if (curIds.includes(hitLight.id)) {
        isDraggingMultiLights.current = true;
        multiLightDragOrigin.current = { x: tile.x, y: tile.y };
        setLightMultiDragDelta(null);
      } else {
        setSelectedLightIds([hitLight.id]);
        setSelectedLightId(hitLight.id);
        isDraggingLight.current = true;
        draggedLightId.current = hitLight.id;
        dragLightOrigin.current = { x: tile.x, y: tile.y };
        setLightDragPreview(null);
      }
    } else {
      if (!(e.metaKey || e.ctrlKey)) {
        const hadSelection = state.selectedLightIds.length > 0;
        setSelectedLightIds([]);
        setSelectedLightId(null);
        // 선택된 항목이 있었으면 선택 해제만 하고 생성/영역선택 진입하지 않음
        if (hadSelection) {
          return true;
        }
      }
      isSelectingLights.current = true;
      lightSelDragStart.current = tile;
      setLightSelectionStart(tile);
      setLightSelectionEnd(tile);
    }
    return true;
  }, [currentMap, pasteLights, setIsLightPasting, setLightPastePreviewPos, setSelectedLightId, setSelectedLightIds, setLightSelectionStart, setLightSelectionEnd]);

  const handleLightMouseMove = useCallback((tile: { x: number; y: number } | null): boolean => {
    // Light multi-drag
    if (isDraggingMultiLights.current && tile && multiLightDragOrigin.current) {
      const dx = tile.x - multiLightDragOrigin.current.x;
      const dy = tile.y - multiLightDragOrigin.current.y;
      if (dx !== 0 || dy !== 0) {
        setLightMultiDragDelta({ dx, dy });
      } else {
        setLightMultiDragDelta(null);
      }
      return true;
    }

    // Light single dragging → convert to multi-drag
    if (isDraggingLight.current && tile && dragLightOrigin.current) {
      if (tile.x !== dragLightOrigin.current.x || tile.y !== dragLightOrigin.current.y) {
        isDraggingLight.current = false;
        isDraggingMultiLights.current = true;
        multiLightDragOrigin.current = dragLightOrigin.current;
        dragLightOrigin.current = null;
        const dx = tile.x - multiLightDragOrigin.current!.x;
        const dy = tile.y - multiLightDragOrigin.current!.y;
        setLightMultiDragDelta({ dx, dy });
        setLightDragPreview(null);
      }
      return true;
    }

    // Light area selection drag
    if (isSelectingLights.current && tile && lightSelDragStart.current) {
      setLightSelectionEnd(tile);
      return true;
    }

    return false;
  }, [setLightSelectionEnd]);

  const handleLightPastePreview = useCallback((tile: { x: number; y: number }): boolean => {
    const state = useEditorStore.getState();
    if (state.isLightPasting) {
      setLightPastePreviewPos(tile);
      return true;
    }
    return false;
  }, [setLightPastePreviewPos]);

  const handleLightMouseUp = useCallback((tile: { x: number; y: number } | null, e: React.MouseEvent<HTMLElement>): boolean => {
    // Light multi-drag commit
    if (isDraggingMultiLights.current) {
      if (tile && multiLightDragOrigin.current) {
        const dx = tile.x - multiLightDragOrigin.current.x;
        const dy = tile.y - multiLightDragOrigin.current.y;
        const state = useEditorStore.getState();
        if (dx !== 0 || dy !== 0) {
          moveLights(state.selectedLightIds, dx, dy);
        }
      }
      isDraggingMultiLights.current = false;
      multiLightDragOrigin.current = null;
      setLightMultiDragDelta(null);
      return true;
    }

    // Light single drag (mouseUp without move)
    if (isDraggingLight.current && draggedLightId.current != null) {
      isDraggingLight.current = false;
      draggedLightId.current = null;
      dragLightOrigin.current = null;
      setLightDragPreview(null);
      return true;
    }

    // Light area selection commit
    if (isSelectingLights.current) {
      isSelectingLights.current = false;
      const start = lightSelDragStart.current;
      lightSelDragStart.current = null;

      if (start && tile && start.x === tile.x && start.y === tile.y) {
        if (lightEditMode && selectedLightType === 'point') {
          addPointLight(tile.x, tile.y);
        }
        setLightSelectionStart(null);
        setLightSelectionEnd(null);
      } else if (start && tile && currentMap?.editorLights?.points) {
        const minX = Math.min(start.x, tile.x);
        const maxX = Math.max(start.x, tile.x);
        const minY = Math.min(start.y, tile.y);
        const maxY = Math.max(start.y, tile.y);
        const lightsInArea = currentMap.editorLights.points
          .filter(l => l.x >= minX && l.x <= maxX && l.y >= minY && l.y <= maxY)
          .map(l => l.id);
        if (e.metaKey || e.ctrlKey) {
          const curIds = useEditorStore.getState().selectedLightIds;
          const merged = [...new Set([...curIds, ...lightsInArea])];
          setSelectedLightIds(merged);
          if (merged.length > 0) setSelectedLightId(merged[merged.length - 1]);
        } else {
          setSelectedLightIds(lightsInArea);
          if (lightsInArea.length > 0) setSelectedLightId(lightsInArea[0]);
          else setSelectedLightId(null);
        }
        setLightSelectionStart(null);
        setLightSelectionEnd(null);
      }
      return true;
    }

    return false;
  }, [currentMap, lightEditMode, selectedLightType, addPointLight, moveLights, setSelectedLightId, setSelectedLightIds, setLightSelectionStart, setLightSelectionEnd]);

  const handleLightMouseLeave = useCallback(() => {
    if (isDraggingMultiLights.current) {
      isDraggingMultiLights.current = false;
      multiLightDragOrigin.current = null;
      setLightMultiDragDelta(null);
    }
    if (isSelectingLights.current) {
      isSelectingLights.current = false;
      lightSelDragStart.current = null;
      setLightSelectionStart(null);
      setLightSelectionEnd(null);
    }
  }, [setLightSelectionStart, setLightSelectionEnd]);

  return {
    isDraggingLight, isSelectingLights,
    lightDragPreview, lightMultiDragDelta,
    handleLightMouseDown, handleLightMouseMove,
    handleLightMouseUp, handleLightMouseLeave,
    handleLightPastePreview,
  };
}
