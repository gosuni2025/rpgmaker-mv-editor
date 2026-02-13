import React, { useRef, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { RPGEvent, EventPage, MapData } from '../../types/rpgMakerMV';
import type { MapToolsResult } from './useMapTools';

export interface EventContextMenu {
  x: number;
  y: number;
  tileX: number;
  tileY: number;
  eventId: number | null;
}

export interface MapContextMenu {
  x: number;
  y: number;
  tileX: number;
  tileY: number;
}

export interface EventDragHandlersResult {
  isDraggingEvent: React.MutableRefObject<boolean>;
  isSelectingEvents: React.MutableRefObject<boolean>;
  dragPreview: { x: number; y: number } | null;
  eventMultiDragDelta: { dx: number; dy: number } | null;
  playerStartDragPos: { x: number; y: number } | null;
  eventCtxMenu: EventContextMenu | null;
  mapCtxMenu: MapContextMenu | null;
  editingEventId: number | null;
  setEditingEventId: (id: number | null) => void;
  closeEventCtxMenu: () => void;
  closeMapCtxMenu: () => void;
  createNewEvent: (x: number, y: number) => void;
  handleEventMouseDown: (tile: { x: number; y: number }, e: React.MouseEvent<HTMLElement>) => boolean;
  handleEventMouseMove: (tile: { x: number; y: number } | null) => boolean;
  handleEventMouseUp: (tile: { x: number; y: number } | null, e: React.MouseEvent<HTMLElement>) => boolean;
  handleEventMouseLeave: () => void;
  handleEventPastePreview: (tile: { x: number; y: number }) => boolean;
  handleDoubleClick: (e: React.MouseEvent<HTMLElement>, canvasToTile: MapToolsResult['canvasToTile']) => void;
  handleContextMenu: (e: React.MouseEvent<HTMLElement>, canvasToTile: MapToolsResult['canvasToTile']) => void;
  handlePlayerStartDragMove: (tile: { x: number; y: number }) => boolean;
  handlePlayerStartDragUp: () => boolean;
  handlePlayerStartDragLeave: () => void;
}

export function useEventDragHandlers(): EventDragHandlersResult {
  const currentMap = useEditorStore((s) => s.currentMap);
  const editMode = useEditorStore((s) => s.editMode);
  const setSelectedEventId = useEditorStore((s) => s.setSelectedEventId);
  const selectedEventIds = useEditorStore((s) => s.selectedEventIds);
  const setSelectedEventIds = useEditorStore((s) => s.setSelectedEventIds);
  const setEventSelectionStart = useEditorStore((s) => s.setEventSelectionStart);
  const setEventSelectionEnd = useEditorStore((s) => s.setEventSelectionEnd);
  const moveEvents = useEditorStore((s) => s.moveEvents);
  const isEventPasting = useEditorStore((s) => s.isEventPasting);
  const setIsEventPasting = useEditorStore((s) => s.setIsEventPasting);
  const setEventPastePreviewPos = useEditorStore((s) => s.setEventPastePreviewPos);
  const pasteEvents = useEditorStore((s) => s.pasteEvents);
  const systemData = useEditorStore((s) => s.systemData);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const setPlayerStartPosition = useEditorStore((s) => s.setPlayerStartPosition);

  // Event drag state
  const isDraggingEvent = useRef(false);
  const draggedEventId = useRef<number | null>(null);
  const dragEventOrigin = useRef<{ x: number; y: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number } | null>(null);

  // Event multi-select drag state
  const isSelectingEvents = useRef(false);
  const eventSelDragStart = useRef<{ x: number; y: number } | null>(null);
  // Event multi-drag state
  const isDraggingMultiEvents = useRef(false);
  const multiEventDragOrigin = useRef<{ x: number; y: number } | null>(null);
  const [eventMultiDragDelta, setEventMultiDragDelta] = useState<{ dx: number; dy: number } | null>(null);

  // Player start position drag state
  const isDraggingPlayerStart = useRef(false);
  const playerStartDragPosRef = useRef<{ x: number; y: number } | null>(null);
  const [playerStartDragPos, setPlayerStartDragPos] = useState<{ x: number; y: number } | null>(null);

  // Context menu & event editing state
  const [eventCtxMenu, setEventCtxMenu] = useState<EventContextMenu | null>(null);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);

  const handleEventMouseDown = useCallback((tile: { x: number; y: number }, e: React.MouseEvent<HTMLElement>): boolean => {
    const state = useEditorStore.getState();

    // 붙여넣기 모드: 클릭으로 배치
    if (state.isEventPasting) {
      pasteEvents(tile.x, tile.y);
      setIsEventPasting(false);
      setEventPastePreviewPos(null);
      return true;
    }

    if (currentMap && currentMap.events) {
      const ev = currentMap.events.find(
        (ev) => ev && ev.id !== 0 && ev.x === tile.x && ev.y === tile.y
      );

      if (ev) {
        const curIds = state.selectedEventIds;
        if (e.metaKey || e.ctrlKey) {
          if (curIds.includes(ev.id)) {
            const newIds = curIds.filter(id => id !== ev.id);
            setSelectedEventIds(newIds);
            setSelectedEventId(newIds.length > 0 ? newIds[newIds.length - 1] : null);
          } else {
            const newIds = [...curIds, ev.id];
            setSelectedEventIds(newIds);
            setSelectedEventId(ev.id);
          }
        } else if (curIds.includes(ev.id)) {
          isDraggingMultiEvents.current = true;
          multiEventDragOrigin.current = { x: tile.x, y: tile.y };
          setEventMultiDragDelta(null);
        } else {
          setSelectedEventIds([ev.id]);
          setSelectedEventId(ev.id);
          isDraggingEvent.current = true;
          draggedEventId.current = ev.id;
          dragEventOrigin.current = { x: tile.x, y: tile.y };
          setDragPreview(null);
        }
      } else {
        // 시작 위치 드래그 확인
        const isPlayerStart = systemData && currentMapId === systemData.startMapId
          && tile.x === systemData.startX && tile.y === systemData.startY;
        if (isPlayerStart && !(e.metaKey || e.ctrlKey)) {
          isDraggingPlayerStart.current = true;
          playerStartDragPosRef.current = { x: tile.x, y: tile.y };
          setPlayerStartDragPos({ x: tile.x, y: tile.y });
          setSelectedEventIds([]);
          setSelectedEventId(null);
          return true;
        }
        // 빈 타일 클릭: 영역 선택 시작
        if (!(e.metaKey || e.ctrlKey)) {
          setSelectedEventIds([]);
          setSelectedEventId(null);
        }
        isSelectingEvents.current = true;
        eventSelDragStart.current = tile;
        setEventSelectionStart(tile);
        setEventSelectionEnd(tile);
      }
    }
    return true;
  }, [currentMap, systemData, currentMapId, pasteEvents, setIsEventPasting, setEventPastePreviewPos, setSelectedEventId, setSelectedEventIds, setEventSelectionStart, setEventSelectionEnd, setPlayerStartPosition]);

  const handleEventMouseMove = useCallback((tile: { x: number; y: number } | null): boolean => {
    // Event multi-drag
    if (isDraggingMultiEvents.current && tile && multiEventDragOrigin.current) {
      const dx = tile.x - multiEventDragOrigin.current.x;
      const dy = tile.y - multiEventDragOrigin.current.y;
      if (dx !== 0 || dy !== 0) {
        setEventMultiDragDelta({ dx, dy });
      } else {
        setEventMultiDragDelta(null);
      }
      return true;
    }

    // Event area selection drag
    if (isSelectingEvents.current && tile && eventSelDragStart.current) {
      setEventSelectionEnd(tile);
      return true;
    }

    // Single event drag → convert to multi-drag
    if (isDraggingEvent.current && tile && dragEventOrigin.current) {
      if (tile.x !== dragEventOrigin.current.x || tile.y !== dragEventOrigin.current.y) {
        isDraggingEvent.current = false;
        isDraggingMultiEvents.current = true;
        multiEventDragOrigin.current = dragEventOrigin.current;
        dragEventOrigin.current = null;
        const dx = tile.x - multiEventDragOrigin.current!.x;
        const dy = tile.y - multiEventDragOrigin.current!.y;
        setEventMultiDragDelta({ dx, dy });
        setDragPreview(null);
      }
      return true;
    }

    return false;
  }, [setEventSelectionEnd]);

  const handleEventPastePreview = useCallback((tile: { x: number; y: number }): boolean => {
    const state = useEditorStore.getState();
    if (state.isEventPasting) {
      setEventPastePreviewPos(tile);
      return true;
    }
    return false;
  }, [setEventPastePreviewPos]);

  const handlePlayerStartDragMove = useCallback((tile: { x: number; y: number }): boolean => {
    if (isDraggingPlayerStart.current) {
      playerStartDragPosRef.current = { x: tile.x, y: tile.y };
      setPlayerStartDragPos({ x: tile.x, y: tile.y });
      return true;
    }
    return false;
  }, []);

  const handlePlayerStartDragUp = useCallback((): boolean => {
    if (isDraggingPlayerStart.current) {
      isDraggingPlayerStart.current = false;
      const dragPos = playerStartDragPosRef.current;
      if (dragPos && currentMapId) {
        setPlayerStartPosition(currentMapId, dragPos.x, dragPos.y).then(() => {
          playerStartDragPosRef.current = null;
          setPlayerStartDragPos(null);
        });
      } else {
        playerStartDragPosRef.current = null;
        setPlayerStartDragPos(null);
      }
      return true;
    }
    return false;
  }, [currentMapId, setPlayerStartPosition]);

  const handlePlayerStartDragLeave = useCallback(() => {
    if (isDraggingPlayerStart.current) {
      isDraggingPlayerStart.current = false;
      playerStartDragPosRef.current = null;
      setPlayerStartDragPos(null);
    }
  }, []);

  const handleEventMouseUp = useCallback((tile: { x: number; y: number } | null, e: React.MouseEvent<HTMLElement>): boolean => {
    // Event multi-drag commit
    if (isDraggingMultiEvents.current) {
      if (tile && multiEventDragOrigin.current) {
        const dx = tile.x - multiEventDragOrigin.current.x;
        const dy = tile.y - multiEventDragOrigin.current.y;
        const state = useEditorStore.getState();
        if (dx !== 0 || dy !== 0) {
          moveEvents(state.selectedEventIds, dx, dy);
        }
      }
      isDraggingMultiEvents.current = false;
      multiEventDragOrigin.current = null;
      setEventMultiDragDelta(null);
      return true;
    }

    // Event area selection commit
    if (isSelectingEvents.current) {
      isSelectingEvents.current = false;
      const start = eventSelDragStart.current;
      eventSelDragStart.current = null;

      if (start && tile && start.x === tile.x && start.y === tile.y) {
        setEventSelectionStart(null);
        setEventSelectionEnd(null);
      } else if (start && tile && currentMap?.events) {
        const minX = Math.min(start.x, tile.x);
        const maxX = Math.max(start.x, tile.x);
        const minY = Math.min(start.y, tile.y);
        const maxY = Math.max(start.y, tile.y);
        const eventsInArea = currentMap.events
          .filter(ev => ev && ev.id !== 0 && ev.x >= minX && ev.x <= maxX && ev.y >= minY && ev.y <= maxY)
          .map(ev => ev!.id);
        if (e.metaKey || e.ctrlKey) {
          const curIds = useEditorStore.getState().selectedEventIds;
          const merged = [...new Set([...curIds, ...eventsInArea])];
          setSelectedEventIds(merged);
          if (merged.length > 0) setSelectedEventId(merged[merged.length - 1]);
        } else {
          setSelectedEventIds(eventsInArea);
          if (eventsInArea.length > 0) setSelectedEventId(eventsInArea[0]);
          else setSelectedEventId(null);
        }
        setEventSelectionStart(null);
        setEventSelectionEnd(null);
      }
      return true;
    }

    // Single event drag (fallback - mouseUp without move)
    if (isDraggingEvent.current && draggedEventId.current != null) {
      isDraggingEvent.current = false;
      draggedEventId.current = null;
      dragEventOrigin.current = null;
      setDragPreview(null);
      return true;
    }

    return false;
  }, [currentMap, moveEvents, setSelectedEventId, setSelectedEventIds, setEventSelectionStart, setEventSelectionEnd]);

  const handleEventMouseLeave = useCallback(() => {
    if (isDraggingEvent.current) {
      isDraggingEvent.current = false;
      draggedEventId.current = null;
      dragEventOrigin.current = null;
      setDragPreview(null);
    }
    if (isDraggingMultiEvents.current) {
      isDraggingMultiEvents.current = false;
      multiEventDragOrigin.current = null;
      setEventMultiDragDelta(null);
    }
    if (isSelectingEvents.current) {
      isSelectingEvents.current = false;
      eventSelDragStart.current = null;
      setEventSelectionStart(null);
      setEventSelectionEnd(null);
    }
  }, [setEventSelectionStart, setEventSelectionEnd]);

  const createNewEvent = useCallback((x: number, y: number) => {
    if (!currentMap) return;
    const oldEvents = [...(currentMap.events || [])];
    const events = [...oldEvents];
    const maxId = events.reduce((max: number, e) => (e && e.id > max ? e.id : max), 0);
    const defaultPage: EventPage = {
      conditions: {
        actorId: 1, actorValid: false, itemId: 1, itemValid: false,
        selfSwitchCh: 'A', selfSwitchValid: false,
        switch1Id: 1, switch1Valid: false, switch2Id: 1, switch2Valid: false,
        variableId: 1, variableValid: false, variableValue: 0,
      },
      directionFix: false,
      image: { characterIndex: 0, characterName: '', direction: 2, pattern: 1, tileId: 0 },
      list: [{ code: 0, indent: 0, parameters: [] }],
      moveFrequency: 3,
      moveRoute: { list: [{ code: 0 }], repeat: true, skippable: false, wait: false },
      moveSpeed: 3,
      moveType: 0,
      priorityType: 1,
      stepAnime: false,
      through: false,
      trigger: 0,
      walkAnime: true,
    };
    const newEvent: RPGEvent = {
      id: maxId + 1,
      name: `EV${String(maxId + 1).padStart(3, '0')}`,
      x, y,
      note: '',
      pages: [defaultPage],
    };
    while (events.length <= maxId + 1) events.push(null);
    events[maxId + 1] = newEvent;
    const state = useEditorStore.getState();
    const mapId = state.currentMapId;
    useEditorStore.setState({ currentMap: { ...currentMap, events } as MapData & { tilesetNames?: string[] } });
    if (mapId) {
      const undoStack = [...useEditorStore.getState().undoStack, {
        mapId, type: 'event' as const,
        oldEvents, newEvents: events,
        oldSelectedEventId: state.selectedEventId,
        oldSelectedEventIds: state.selectedEventIds,
      }];
      if (undoStack.length > state.maxUndo) undoStack.shift();
      useEditorStore.setState({ undoStack, redoStack: [] });
    }
    setSelectedEventId(maxId + 1);
    setEditingEventId(maxId + 1);
  }, [currentMap, setSelectedEventId]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLElement>, canvasToTile: MapToolsResult['canvasToTile']) => {
    if (editMode !== 'event') return;
    const tile = canvasToTile(e);
    if (!tile || !currentMap || !currentMap.events) return;
    const ev = currentMap.events.find(
      (ev) => ev && ev.id !== 0 && ev.x === tile.x && ev.y === tile.y
    );
    if (ev) {
      setSelectedEventId(ev.id);
      setEditingEventId(ev.id);
    } else {
      createNewEvent(tile.x, tile.y);
    }
  }, [editMode, currentMap, setSelectedEventId, createNewEvent]);

  const [mapCtxMenu, setMapCtxMenu] = useState<MapContextMenu | null>(null);
  const closeMapCtxMenu = useCallback(() => setMapCtxMenu(null), []);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLElement>, canvasToTile: MapToolsResult['canvasToTile']) => {
    e.preventDefault();
    if (editMode === 'event') {
      const state = useEditorStore.getState();
      if (state.isEventPasting) {
        setIsEventPasting(false);
        setEventPastePreviewPos(null);
        return;
      }
      const tile = canvasToTile(e);
      if (!tile || !currentMap) return;
      const ev = currentMap.events?.find(
        (ev) => ev && ev.id !== 0 && ev.x === tile.x && ev.y === tile.y
      );
      setEventCtxMenu({
        x: e.clientX,
        y: e.clientY,
        tileX: tile.x,
        tileY: tile.y,
        eventId: ev ? ev.id : null,
      });
    } else if (editMode === 'map') {
      const tile = canvasToTile(e);
      if (!tile) return;
      setMapCtxMenu({
        x: e.clientX,
        y: e.clientY,
        tileX: tile.x,
        tileY: tile.y,
      });
    }
  }, [editMode, currentMap, setIsEventPasting, setEventPastePreviewPos]);

  const closeEventCtxMenu = useCallback(() => setEventCtxMenu(null), []);

  return {
    isDraggingEvent, isSelectingEvents,
    dragPreview, eventMultiDragDelta, playerStartDragPos,
    eventCtxMenu, mapCtxMenu, editingEventId, setEditingEventId,
    closeEventCtxMenu, closeMapCtxMenu, createNewEvent,
    handleEventMouseDown, handleEventMouseMove,
    handleEventMouseUp, handleEventMouseLeave,
    handleEventPastePreview,
    handleDoubleClick, handleContextMenu,
    handlePlayerStartDragMove, handlePlayerStartDragUp, handlePlayerStartDragLeave,
  };
}
