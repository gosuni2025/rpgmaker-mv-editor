import React, { useRef, useState, useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { RPGEvent, EventPage } from '../../types/rpgMakerMV';
import type { MapToolsResult } from './useMapTools';
import { useStartPositionDrag } from './useStartPositionDrag';

export interface EventContextMenu {
  x: number;
  y: number;
  tileX: number;
  tileY: number;
  eventId: number | null;
}

export interface EventDragHandlersResult {
  isDraggingEvent: React.MutableRefObject<boolean>;
  isSelectingEvents: React.MutableRefObject<boolean>;
  dragPreview: { x: number; y: number } | null;
  eventMultiDragDelta: { dx: number; dy: number } | null;
  playerStartDragPos: { x: number; y: number } | null;
  testStartDragPos: { x: number; y: number } | null;
  vehicleStartDragPos: { x: number; y: number; vehicle: 'boat' | 'ship' | 'airship' } | null;
  eventCtxMenu: EventContextMenu | null;
  editingEventId: number | null;
  setEditingEventId: (id: number | null) => void;
  pendingNewEvent: RPGEvent | null;
  setPendingNewEvent: (event: RPGEvent | null) => void;
  closeEventCtxMenu: () => void;
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
  const setSelectedEventIds = useEditorStore((s) => s.setSelectedEventIds);
  const setEventSelectionStart = useEditorStore((s) => s.setEventSelectionStart);
  const setEventSelectionEnd = useEditorStore((s) => s.setEventSelectionEnd);
  const moveEvents = useEditorStore((s) => s.moveEvents);
  const setIsEventPasting = useEditorStore((s) => s.setIsEventPasting);
  const setEventPastePreviewPos = useEditorStore((s) => s.setEventPastePreviewPos);
  const pasteEvents = useEditorStore((s) => s.pasteEvents);
  const systemData = useEditorStore((s) => s.systemData);
  const currentMapId = useEditorStore((s) => s.currentMapId);
<<<<<<< HEAD
  const setPlayerStartPosition = useEditorStore((s) => s.setPlayerStartPosition);
  const setTestStartPosition = useEditorStore((s) => s.setTestStartPosition);
  const setVehicleStartPosition = useEditorStore((s) => s.setVehicleStartPosition);
  const setSelectedStartPosition = useEditorStore((s) => s.setSelectedStartPosition);
=======
  const setSelectedStartPosition = useEditorStore((s) => s.setSelectedStartPosition);

  const startPosDrag = useStartPositionDrag();
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f

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

<<<<<<< HEAD
  // Player start position drag state
  const isDraggingPlayerStart = useRef(false);
  const playerStartDragPosRef = useRef<{ x: number; y: number } | null>(null);
  const playerStartDragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [playerStartDragPos, setPlayerStartDragPos] = useState<{ x: number; y: number } | null>(null);

  // Test start position drag state
  const isDraggingTestStart = useRef(false);
  const testStartDragPosRef = useRef<{ x: number; y: number } | null>(null);
  const testStartDragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [testStartDragPos, setTestStartDragPos] = useState<{ x: number; y: number } | null>(null);

  // Vehicle start position drag state
  const isDraggingVehicleStart = useRef<'boat' | 'ship' | 'airship' | null>(null);
  const vehicleStartDragPosRef = useRef<{ x: number; y: number } | null>(null);
  const vehicleStartDragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const [vehicleStartDragPos, setVehicleStartDragPos] = useState<{ x: number; y: number; vehicle: 'boat' | 'ship' | 'airship' } | null>(null);

=======
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
  // Context menu & event editing state
  const [eventCtxMenu, setEventCtxMenu] = useState<EventContextMenu | null>(null);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [pendingNewEvent, setPendingNewEvent] = useState<RPGEvent | null>(null);

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
<<<<<<< HEAD
        // 시작 위치 클릭 확인 (플레이어 + 탈것)
        const isPlayerStart = systemData && currentMapId === systemData.startMapId
          && tile.x === systemData.startX && tile.y === systemData.startY;
        
        // 탈것 시작 위치 확인
        let vehicleStart: 'boat' | 'ship' | 'airship' | null = null;
        if (systemData && !(e.metaKey || e.ctrlKey)) {
          for (const vk of ['boat', 'ship', 'airship'] as const) {
            const vData = systemData[vk];
            if (vData && vData.startMapId === currentMapId && tile.x === vData.startX && tile.y === vData.startY) {
              vehicleStart = vk;
              break;
            }
          }
        }

        if (isPlayerStart && !(e.metaKey || e.ctrlKey)) {
          // 플레이어 시작 위치: 선택 + 드래그 준비
          isDraggingPlayerStart.current = true;
          playerStartDragPosRef.current = { x: tile.x, y: tile.y };
          playerStartDragOriginRef.current = { x: tile.x, y: tile.y };
          setPlayerStartDragPos({ x: tile.x, y: tile.y });
          setSelectedEventIds([]);
          setSelectedEventId(null);
          setSelectedStartPosition('player');
          return true;
        }

        if (vehicleStart && !(e.metaKey || e.ctrlKey)) {
          // 탈것 시작 위치: 선택 + 드래그 준비
          isDraggingVehicleStart.current = vehicleStart;
          vehicleStartDragPosRef.current = { x: tile.x, y: tile.y };
          vehicleStartDragOriginRef.current = { x: tile.x, y: tile.y };
          setVehicleStartDragPos({ x: tile.x, y: tile.y, vehicle: vehicleStart });
          setSelectedEventIds([]);
          setSelectedEventId(null);
          setSelectedStartPosition(vehicleStart);
          return true;
        }

        // 테스트 시작 위치 드래그 확인
        const testPos = currentMap.testStartPosition;
        if (testPos && tile.x === testPos.x && tile.y === testPos.y && !(e.metaKey || e.ctrlKey)) {
          isDraggingTestStart.current = true;
          testStartDragPosRef.current = { x: tile.x, y: tile.y };
          testStartDragOriginRef.current = { x: tile.x, y: tile.y };
          setTestStartDragPos({ x: tile.x, y: tile.y });
          setSelectedEventIds([]);
          setSelectedEventId(null);
          setSelectedStartPosition(null);
          return true;
        }
=======
        // 시작 위치 클릭 확인 (플레이어 + 탈것 + 테스트)
        if (startPosDrag.tryStartPositionMouseDown(tile, e)) return true;

>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
        // 빈 타일 클릭: 영역 선택 시작
        if (!(e.metaKey || e.ctrlKey)) {
          const hadSelection = state.selectedEventIds.length > 0;
          const hadStartSel = useEditorStore.getState().selectedStartPosition != null;
          setSelectedEventIds([]);
          setSelectedEventId(null);
          setSelectedStartPosition(null);
<<<<<<< HEAD
          // 선택된 항목이 있었으면 선택 해제만 하고 영역선택 진입하지 않음
          if (hadSelection || hadStartSel) {
            return true;
          }
=======
          if (hadSelection || hadStartSel) return true;
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
        }
        isSelectingEvents.current = true;
        eventSelDragStart.current = tile;
        setEventSelectionStart(tile);
        setEventSelectionEnd(tile);
      }
    }
    return true;
  }, [currentMap, pasteEvents, setIsEventPasting, setEventPastePreviewPos, setSelectedEventId, setSelectedEventIds, setEventSelectionStart, setEventSelectionEnd, startPosDrag.tryStartPositionMouseDown, setSelectedStartPosition]);

  const handleEventMouseMove = useCallback((tile: { x: number; y: number } | null): boolean => {
    if (isDraggingMultiEvents.current && tile && multiEventDragOrigin.current) {
      const dx = tile.x - multiEventDragOrigin.current.x;
      const dy = tile.y - multiEventDragOrigin.current.y;
      setEventMultiDragDelta(dx !== 0 || dy !== 0 ? { dx, dy } : null);
      return true;
    }
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
    if (useEditorStore.getState().isEventPasting) {
      setEventPastePreviewPos(tile);
      return true;
    }
    return false;
  }, [setEventPastePreviewPos]);

<<<<<<< HEAD
  const handlePlayerStartDragMove = useCallback((tile: { x: number; y: number }): boolean => {
    if (isDraggingPlayerStart.current) {
      playerStartDragPosRef.current = { x: tile.x, y: tile.y };
      setPlayerStartDragPos({ x: tile.x, y: tile.y });
      return true;
    }
    if (isDraggingTestStart.current) {
      testStartDragPosRef.current = { x: tile.x, y: tile.y };
      setTestStartDragPos({ x: tile.x, y: tile.y });
      return true;
    }
    if (isDraggingVehicleStart.current) {
      vehicleStartDragPosRef.current = { x: tile.x, y: tile.y };
      setVehicleStartDragPos({ x: tile.x, y: tile.y, vehicle: isDraggingVehicleStart.current });
      return true;
    }
    return false;
  }, []);

  const handlePlayerStartDragUp = useCallback((): boolean => {
    if (isDraggingPlayerStart.current) {
      isDraggingPlayerStart.current = false;
      const dragPos = playerStartDragPosRef.current;
      const origin = playerStartDragOriginRef.current;
      const moved = dragPos && origin && (dragPos.x !== origin.x || dragPos.y !== origin.y);
      if (moved && currentMapId) {
        setPlayerStartPosition(currentMapId, dragPos!.x, dragPos!.y).then(() => {
          playerStartDragPosRef.current = null;
          playerStartDragOriginRef.current = null;
          setPlayerStartDragPos(null);
        });
      } else {
        playerStartDragPosRef.current = null;
        playerStartDragOriginRef.current = null;
        setPlayerStartDragPos(null);
      }
      return true;
    }
    if (isDraggingTestStart.current) {
      isDraggingTestStart.current = false;
      const dragPos = testStartDragPosRef.current;
      const origin = testStartDragOriginRef.current;
      const moved = dragPos && origin && (dragPos.x !== origin.x || dragPos.y !== origin.y);
      if (moved) {
        setTestStartPosition(dragPos!.x, dragPos!.y);
      }
      testStartDragPosRef.current = null;
      testStartDragOriginRef.current = null;
      setTestStartDragPos(null);
      return true;
    }
    if (isDraggingVehicleStart.current) {
      const vehicle = isDraggingVehicleStart.current;
      isDraggingVehicleStart.current = null;
      const dragPos = vehicleStartDragPosRef.current;
      const origin = vehicleStartDragOriginRef.current;
      const moved = dragPos && origin && (dragPos.x !== origin.x || dragPos.y !== origin.y);
      if (moved && currentMapId) {
        setVehicleStartPosition(vehicle, currentMapId, dragPos!.x, dragPos!.y).then(() => {
          vehicleStartDragPosRef.current = null;
          vehicleStartDragOriginRef.current = null;
          setVehicleStartDragPos(null);
        });
      } else {
        vehicleStartDragPosRef.current = null;
        vehicleStartDragOriginRef.current = null;
        setVehicleStartDragPos(null);
      }
      return true;
    }
    return false;
  }, [currentMapId, setPlayerStartPosition, setTestStartPosition, setVehicleStartPosition]);

  const handlePlayerStartDragLeave = useCallback(() => {
    if (isDraggingPlayerStart.current) {
      isDraggingPlayerStart.current = false;
      playerStartDragPosRef.current = null;
      playerStartDragOriginRef.current = null;
      setPlayerStartDragPos(null);
    }
    if (isDraggingTestStart.current) {
      isDraggingTestStart.current = false;
      testStartDragPosRef.current = null;
      testStartDragOriginRef.current = null;
      setTestStartDragPos(null);
    }
    if (isDraggingVehicleStart.current) {
      isDraggingVehicleStart.current = null;
      vehicleStartDragPosRef.current = null;
      vehicleStartDragOriginRef.current = null;
      setVehicleStartDragPos(null);
    }
  }, []);

=======
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
  const handleEventMouseUp = useCallback((tile: { x: number; y: number } | null, e: React.MouseEvent<HTMLElement>): boolean => {
    if (isDraggingMultiEvents.current) {
      if (tile && multiEventDragOrigin.current) {
        const dx = tile.x - multiEventDragOrigin.current.x;
        const dy = tile.y - multiEventDragOrigin.current.y;
        const state = useEditorStore.getState();
        if (dx !== 0 || dy !== 0) moveEvents(state.selectedEventIds, dx, dy);
      }
      isDraggingMultiEvents.current = false;
      multiEventDragOrigin.current = null;
      setEventMultiDragDelta(null);
      return true;
    }
    if (isSelectingEvents.current) {
      isSelectingEvents.current = false;
      const start = eventSelDragStart.current;
      eventSelDragStart.current = null;
      if (start && tile && start.x === tile.x && start.y === tile.y) {
        setEventSelectionStart(null);
        setEventSelectionEnd(null);
      } else if (start && tile && currentMap?.events) {
        const minX = Math.min(start.x, tile.x), maxX = Math.max(start.x, tile.x);
        const minY = Math.min(start.y, tile.y), maxY = Math.max(start.y, tile.y);
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
          setSelectedEventId(eventsInArea.length > 0 ? eventsInArea[0] : null);
        }
        setEventSelectionStart(null);
        setEventSelectionEnd(null);
      }
      return true;
    }
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
    const events = [...(currentMap.events || [])];
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
      moveSpeed: 3, moveType: 0, priorityType: 1,
      stepAnime: false, through: false, trigger: 0, walkAnime: true,
    };
    const newEvent: RPGEvent = {
      id: maxId + 1, name: `EV${String(maxId + 1).padStart(3, '0')}`,
      x, y, note: '', pages: [defaultPage],
    };
    setPendingNewEvent(newEvent);
  }, [currentMap]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLElement>, canvasToTile: MapToolsResult['canvasToTile']) => {
    if (editMode !== 'event') return;
    const tile = canvasToTile(e);
    if (!tile || !currentMap || !currentMap.events) return;

<<<<<<< HEAD
    // 시작 위치(플레이어/탈것/테스트) 위에서는 더블클릭 무시
    const isPlayerStart = systemData && currentMapId === systemData.startMapId
      && tile.x === systemData.startX && tile.y === systemData.startY;
    if (isPlayerStart) return;

=======
    // 시작 위치에서는 더블클릭 무시
    const isPlayerStart = systemData && currentMapId === systemData.startMapId
      && tile.x === systemData.startX && tile.y === systemData.startY;
    if (isPlayerStart) return;
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
    if (systemData) {
      for (const vk of ['boat', 'ship', 'airship'] as const) {
        const vData = systemData[vk];
        if (vData && vData.startMapId === currentMapId && tile.x === vData.startX && tile.y === vData.startY) return;
      }
<<<<<<< HEAD
    }

    const testPos = currentMap.testStartPosition;
    if (testPos && tile.x === testPos.x && tile.y === testPos.y) return;

    const ev = currentMap.events.find(
      (ev) => ev && ev.id !== 0 && ev.x === tile.x && ev.y === tile.y
    );
    if (ev) {
      setSelectedEventId(ev.id);
      setEditingEventId(ev.id);
    } else {
      createNewEvent(tile.x, tile.y);
    }
=======
    }
    const testPos = currentMap.testStartPosition;
    if (testPos && tile.x === testPos.x && tile.y === testPos.y) return;

    const ev = currentMap.events.find((ev) => ev && ev.id !== 0 && ev.x === tile.x && ev.y === tile.y);
    if (ev) { setSelectedEventId(ev.id); setEditingEventId(ev.id); }
    else createNewEvent(tile.x, tile.y);
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
  }, [editMode, currentMap, systemData, currentMapId, setSelectedEventId, createNewEvent]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLElement>, canvasToTile: MapToolsResult['canvasToTile']) => {
    e.preventDefault();
<<<<<<< HEAD
    // 3D 모드에서는 우클릭이 카메라 이동으로 사용됨
=======
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
    if (useEditorStore.getState().mode3d) return;
    if (editMode === 'event') {
      if (useEditorStore.getState().isEventPasting) {
        setIsEventPasting(false);
        setEventPastePreviewPos(null);
        return;
      }
      const tile = canvasToTile(e);
      if (!tile || !currentMap) return;
      const ev = currentMap.events?.find((ev) => ev && ev.id !== 0 && ev.x === tile.x && ev.y === tile.y);
      setEventCtxMenu({ x: e.clientX, y: e.clientY, tileX: tile.x, tileY: tile.y, eventId: ev ? ev.id : null });
    }
    // 맵 모드에서는 컨텍스트 메뉴 없음 (우클릭은 삭제)
  }, [editMode, currentMap, setIsEventPasting, setEventPastePreviewPos]);

  const closeEventCtxMenu = useCallback(() => setEventCtxMenu(null), []);

  return {
    isDraggingEvent, isSelectingEvents,
<<<<<<< HEAD
    dragPreview, eventMultiDragDelta, playerStartDragPos, testStartDragPos, vehicleStartDragPos,
=======
    dragPreview, eventMultiDragDelta,
    playerStartDragPos: startPosDrag.playerStartDragPos,
    testStartDragPos: startPosDrag.testStartDragPos,
    vehicleStartDragPos: startPosDrag.vehicleStartDragPos,
>>>>>>> fc6cde345bca626bcd2fcb60fafd18ccce0a223f
    eventCtxMenu, editingEventId, setEditingEventId,
    pendingNewEvent, setPendingNewEvent,
    closeEventCtxMenu, createNewEvent,
    handleEventMouseDown, handleEventMouseMove,
    handleEventMouseUp, handleEventMouseLeave,
    handleEventPastePreview,
    handleDoubleClick, handleContextMenu,
    handlePlayerStartDragMove: startPosDrag.handleStartPositionDragMove,
    handlePlayerStartDragUp: startPosDrag.handleStartPositionDragUp,
    handlePlayerStartDragLeave: startPosDrag.handleStartPositionDragLeave,
  };
}
