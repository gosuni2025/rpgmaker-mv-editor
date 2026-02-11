import { useRef, useEffect, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';

interface KeyboardShortcutsResult {
  showGrid: boolean;
  altPressed: boolean;
  panning: boolean;
}

export function useKeyboardShortcuts(
  containerRef: React.RefObject<HTMLDivElement | null>,
): KeyboardShortcutsResult {
  const [altPressed, setAltPressed] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [panning, setPanning] = useState(false);
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const editMode = useEditorStore((s) => s.editMode);
  const selectedEventId = useEditorStore((s) => s.selectedEventId);
  const selectedLightId = useEditorStore((s) => s.selectedLightId);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const lightEditMode = useEditorStore((s) => s.lightEditMode);
  const deletePointLight = useEditorStore((s) => s.deletePointLight);
  const setSelectedLightId = useEditorStore((s) => s.setSelectedLightId);
  const deleteObject = useEditorStore((s) => s.deleteObject);
  const deleteEvent = useEditorStore((s) => s.deleteEvent);
  const copyEvent = useEditorStore((s) => s.copyEvent);
  const pasteEvent = useEditorStore((s) => s.pasteEvent);
  const selectedEventIds = useEditorStore((s) => s.selectedEventIds);
  const copyEvents = useEditorStore((s) => s.copyEvents);
  const pasteEvents = useEditorStore((s) => s.pasteEvents);
  const deleteEvents = useEditorStore((s) => s.deleteEvents);
  const setIsEventPasting = useEditorStore((s) => s.setIsEventPasting);
  const setEventPastePreviewPos = useEditorStore((s) => s.setEventPastePreviewPos);
  const isEventPasting = useEditorStore((s) => s.isEventPasting);
  const clearEventSelection = useEditorStore((s) => s.clearEventSelection);
  const clipboard = useEditorStore((s) => s.clipboard);
  const currentMap = useEditorStore((s) => s.currentMap);
  const selectionStart = useEditorStore((s) => s.selectionStart);
  const selectionEnd = useEditorStore((s) => s.selectionEnd);
  const copyTiles = useEditorStore((s) => s.copyTiles);
  const cutTiles = useEditorStore((s) => s.cutTiles);
  const deleteTiles = useEditorStore((s) => s.deleteTiles);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const setSelection = useEditorStore((s) => s.setSelection);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const isPasting = useEditorStore((s) => s.isPasting);
  const setIsPasting = useEditorStore((s) => s.setIsPasting);
  const setPastePreviewPos = useEditorStore((s) => s.setPastePreviewPos);
  const cursorTileX = useEditorStore((s) => s.cursorTileX);
  const cursorTileY = useEditorStore((s) => s.cursorTileY);
  const showToast = useEditorStore((s) => s.showToast);

  // Alt key state for eyedropper cursor
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Alt') setAltPressed(true); };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Alt') setAltPressed(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Mouse wheel zoom & middle click panning
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else if (e.deltaY > 0) zoomOut();
    };
    el.addEventListener('wheel', handleWheel, { passive: false });

    // 미들 클릭 패닝
    const handlePanStart = (e: MouseEvent) => {
      if (e.button !== 1) return; // 미들 클릭만
      e.preventDefault();
      isPanning.current = true;
      setPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    };
    const handlePanMove = (e: MouseEvent) => {
      if (!isPanning.current) return;
      el.scrollLeft = panStart.current.scrollLeft - (e.clientX - panStart.current.x);
      el.scrollTop = panStart.current.scrollTop - (e.clientY - panStart.current.y);
    };
    const handlePanEnd = (e: MouseEvent) => {
      if (e.button !== 1 || !isPanning.current) return;
      isPanning.current = false;
      setPanning(false);
    };

    el.addEventListener('mousedown', handlePanStart);
    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanEnd);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('mousedown', handlePanStart);
      window.removeEventListener('mousemove', handlePanMove);
      window.removeEventListener('mouseup', handlePanEnd);
    };
  }, [zoomIn, zoomOut]);

  // Grid toggle
  useEffect(() => {
    const handler = (e: Event) => setShowGrid((e as CustomEvent<boolean>).detail);
    window.addEventListener('editor-toggle-grid', handler);
    return () => window.removeEventListener('editor-toggle-grid', handler);
  }, []);

  // Handle Delete key for events, lights, objects, and tile selection
  useEffect(() => {
    const handleDelete = () => {
      // 맵 모드에서 선택 영역 삭제
      if (editMode === 'map' && selectionStart && selectionEnd) {
        deleteTiles(selectionStart.x, selectionStart.y, selectionEnd.x, selectionEnd.y);
        clearSelection();
        showToast('선택 영역 삭제됨');
        return;
      }
      if (lightEditMode && selectedLightId != null) {
        deletePointLight(selectedLightId);
        setSelectedLightId(null);
        return;
      }
      if (editMode === 'object' && selectedObjectId != null) {
        deleteObject(selectedObjectId);
        return;
      }
      if (editMode === 'event') {
        if (selectedEventIds.length > 0) {
          deleteEvents(selectedEventIds);
          showToast(`이벤트 ${selectedEventIds.length}개 삭제됨`);
        } else if (selectedEventId != null) {
          deleteEvent(selectedEventId);
        }
      }
    };
    window.addEventListener('editor-delete', handleDelete);
    return () => window.removeEventListener('editor-delete', handleDelete);
  }, [editMode, selectedEventId, deleteEvent, lightEditMode, selectedLightId, deletePointLight, setSelectedLightId, selectedObjectId, deleteObject, selectionStart, selectionEnd, deleteTiles, clearSelection, showToast]);

  // Handle Copy/Cut/Paste for events and tile selection
  useEffect(() => {
    const handleCopy = () => {
      if (editMode === 'map' && selectionStart && selectionEnd) {
        copyTiles(selectionStart.x, selectionStart.y, selectionEnd.x, selectionEnd.y);
        showToast('선택 영역 복사됨');
        return;
      }
      if (editMode === 'event') {
        if (selectedEventIds.length > 0) {
          copyEvents(selectedEventIds);
          showToast(`이벤트 ${selectedEventIds.length}개 복사됨`);
        } else if (selectedEventId != null) {
          copyEvent(selectedEventId);
          showToast('이벤트 복사됨');
        }
        return;
      }
    };
    const handleCut = () => {
      if (editMode === 'map' && selectionStart && selectionEnd) {
        cutTiles(selectionStart.x, selectionStart.y, selectionEnd.x, selectionEnd.y);
        clearSelection();
        showToast('선택 영역 잘라내기');
        return;
      }
      if (editMode === 'event') {
        if (selectedEventIds.length > 0) {
          copyEvents(selectedEventIds);
          deleteEvents(selectedEventIds);
          showToast(`이벤트 ${selectedEventIds.length}개 잘라내기`);
        } else if (selectedEventId != null) {
          copyEvent(selectedEventId);
          deleteEvent(selectedEventId);
          showToast('이벤트 잘라내기');
        }
        return;
      }
    };
    const handlePaste = () => {
      if (editMode === 'map' && clipboard?.type === 'tiles') {
        setIsPasting(true);
        setPastePreviewPos({ x: cursorTileX, y: cursorTileY });
        showToast('붙여넣기 모드 - 클릭하여 배치');
        return;
      }
      if (editMode === 'event' && (clipboard?.type === 'event' || clipboard?.type === 'events')) {
        setIsEventPasting(true);
        setEventPastePreviewPos({ x: cursorTileX, y: cursorTileY });
        showToast('붙여넣기 모드 - 클릭하여 배치');
        return;
      }
    };
    window.addEventListener('editor-copy', handleCopy);
    window.addEventListener('editor-cut', handleCut);
    window.addEventListener('editor-paste', handlePaste);
    return () => {
      window.removeEventListener('editor-copy', handleCopy);
      window.removeEventListener('editor-cut', handleCut);
      window.removeEventListener('editor-paste', handlePaste);
    };
  }, [editMode, selectedEventId, selectedEventIds, copyEvent, copyEvents, deleteEvent, deleteEvents, pasteEvent, pasteEvents, clipboard, currentMap, selectionStart, selectionEnd, copyTiles, cutTiles, clearSelection, setIsPasting, setPastePreviewPos, setIsEventPasting, setEventPastePreviewPos, cursorTileX, cursorTileY, showToast]);

  // Handle Select All (Cmd+A)
  useEffect(() => {
    const handleSelectAll = () => {
      if (editMode === 'map' && selectedTool === 'select' && currentMap) {
        setSelection({ x: 0, y: 0 }, { x: currentMap.width - 1, y: currentMap.height - 1 });
        showToast('전체 선택');
      }
      if (editMode === 'event' && currentMap?.events) {
        const allIds = currentMap.events
          .filter(e => e && e.id !== 0)
          .map(e => e!.id);
        useEditorStore.getState().setSelectedEventIds(allIds);
        showToast(`전체 선택 (${allIds.length}개)`);
      }
    };
    window.addEventListener('editor-selectall', handleSelectAll);
    return () => window.removeEventListener('editor-selectall', handleSelectAll);
  }, [editMode, selectedTool, currentMap, setSelection, showToast]);

  // Handle Deselect (Cmd+D)
  useEffect(() => {
    const handleDeselect = () => {
      if (editMode === 'map') {
        if (isPasting) {
          setIsPasting(false);
          setPastePreviewPos(null);
        }
        clearSelection();
      }
      if (editMode === 'event') {
        if (isEventPasting) {
          setIsEventPasting(false);
          setEventPastePreviewPos(null);
        }
        clearEventSelection();
      }
    };
    window.addEventListener('editor-deselect', handleDeselect);
    return () => window.removeEventListener('editor-deselect', handleDeselect);
  }, [editMode, isPasting, isEventPasting, setIsPasting, setPastePreviewPos, clearSelection, setIsEventPasting, setEventPastePreviewPos, clearEventSelection]);

  // Handle Escape key for selection/paste cancel
  useEffect(() => {
    const handleEscape = () => {
      if (isEventPasting) {
        setIsEventPasting(false);
        setEventPastePreviewPos(null);
        return;
      }
      if (isPasting) {
        setIsPasting(false);
        setPastePreviewPos(null);
        return;
      }
      if (selectionStart || selectionEnd) {
        clearSelection();
        return;
      }
      // 이벤트 선택 해제
      const state = useEditorStore.getState();
      if (state.selectedEventIds.length > 0) {
        clearEventSelection();
      }
    };
    window.addEventListener('editor-escape', handleEscape);
    return () => window.removeEventListener('editor-escape', handleEscape);
  }, [isPasting, isEventPasting, selectionStart, selectionEnd, setIsPasting, setPastePreviewPos, clearSelection, setIsEventPasting, setEventPastePreviewPos, clearEventSelection]);

  return { showGrid, altPressed, panning };
}
