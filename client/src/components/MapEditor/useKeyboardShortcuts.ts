import { useRef, useEffect, useState } from 'react';
import useEditorStore from '../../store/useEditorStore';

interface KeyboardShortcutsResult {
  showGrid: boolean;
  showTileId: boolean;
  altPressed: boolean;
  panning: boolean;
}

export function useKeyboardShortcuts(
  containerRef: React.RefObject<HTMLDivElement | null>,
): KeyboardShortcutsResult {
  const [altPressed, setAltPressed] = useState(false);
  const showGrid = useEditorStore((s) => s.showGrid);
  const [showTileId, setShowTileId] = useState(false);
  const [panning, setPanning] = useState(false);
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const mode3d = useEditorStore((s) => s.mode3d);
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
  const setSelectedTool = useEditorStore((s) => s.setSelectedTool);
  const setSelection = useEditorStore((s) => s.setSelection);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const isPasting = useEditorStore((s) => s.isPasting);
  const setIsPasting = useEditorStore((s) => s.setIsPasting);
  const setPastePreviewPos = useEditorStore((s) => s.setPastePreviewPos);
  const cursorTileX = useEditorStore((s) => s.cursorTileX);
  const cursorTileY = useEditorStore((s) => s.cursorTileY);
  const showToast = useEditorStore((s) => s.showToast);

  // Light multi-select
  const selectedLightIds = useEditorStore((s) => s.selectedLightIds);
  const copyLights = useEditorStore((s) => s.copyLights);
  const deleteLights = useEditorStore((s) => s.deleteLights);
  const isLightPasting = useEditorStore((s) => s.isLightPasting);
  const setIsLightPasting = useEditorStore((s) => s.setIsLightPasting);
  const setLightPastePreviewPos = useEditorStore((s) => s.setLightPastePreviewPos);
  const clearLightSelection = useEditorStore((s) => s.clearLightSelection);

  // Object multi-select
  const selectedObjectIds = useEditorStore((s) => s.selectedObjectIds);
  const copyObjects = useEditorStore((s) => s.copyObjects);
  const deleteObjects = useEditorStore((s) => s.deleteObjects);
  const isObjectPasting = useEditorStore((s) => s.isObjectPasting);
  const setIsObjectPasting = useEditorStore((s) => s.setIsObjectPasting);
  const setObjectPastePreviewPos = useEditorStore((s) => s.setObjectPastePreviewPos);
  const clearObjectSelection = useEditorStore((s) => s.clearObjectSelection);

  // Camera zone multi-select
  const selectedCameraZoneId = useEditorStore((s) => s.selectedCameraZoneId);
  const selectedCameraZoneIds = useEditorStore((s) => s.selectedCameraZoneIds);
  const deleteCameraZone = useEditorStore((s) => s.deleteCameraZone);
  const deleteCameraZones = useEditorStore((s) => s.deleteCameraZones);

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

  // 3D 카메라 조작 refs
  const isRotating3D = useRef(false); // 중클릭 드래그: 카메라 회전
  const isPanning3D = useRef(false);  // 우클릭 드래그: 카메라 이동
  const cam3DStart = useRef({ x: 0, y: 0, tiltDeg: 0, yawDeg: 0, panX: 0, panY: 0 });

  // Mouse wheel zoom & middle click panning / 3D camera controls
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const Mode3D = (window as any).Mode3D;

    const handleWheel = (e: WheelEvent) => {
      // 모달 다이얼로그 위에서의 wheel 이벤트는 무시 (줌 방지)
      if ((e.target as HTMLElement).closest?.('.db-dialog-overlay')) return;
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else if (e.deltaY > 0) zoomOut();
    };
    el.addEventListener('wheel', handleWheel, { passive: false });

    const handleMouseDown = (e: MouseEvent) => {
      const is3D = useEditorStore.getState().mode3d;

      // 3D 모드: 중클릭 → 카메라 회전
      if (e.button === 1 && is3D && Mode3D) {
        e.preventDefault();
        isRotating3D.current = true;
        isPanning.current = true;
        setPanning(true);
        cam3DStart.current = {
          x: e.clientX, y: e.clientY,
          tiltDeg: Mode3D._tiltDeg, yawDeg: Mode3D._yawDeg,
          panX: 0, panY: 0,
        };
        return;
      }

      // 3D 모드: 우클릭 → 카메라 이동
      if (e.button === 2 && is3D && Mode3D) {
        e.preventDefault();
        isPanning3D.current = true;
        isPanning.current = true;
        setPanning(true);
        cam3DStart.current = {
          x: e.clientX, y: e.clientY,
          tiltDeg: 0, yawDeg: 0,
          panX: Mode3D._editorPanX || 0,
          panY: Mode3D._editorPanY || 0,
        };
        return;
      }

      // 2D 모드: 미들 클릭 패닝
      if (e.button === 1) {
        e.preventDefault();
        isPanning.current = true;
        setPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // 3D 카메라 회전 (중클릭 드래그)
      if (isRotating3D.current && Mode3D) {
        const dx = e.clientX - cam3DStart.current.x;
        const dy = e.clientY - cam3DStart.current.y;
        const sensitivity = 0.3;
        Mode3D._yawDeg = cam3DStart.current.yawDeg + dx * sensitivity;
        Mode3D._yawRad = Mode3D._yawDeg * Math.PI / 180;
        Mode3D._tiltDeg = Math.max(5, Math.min(89, cam3DStart.current.tiltDeg - dy * sensitivity));
        Mode3D._tiltRad = Mode3D._tiltDeg * Math.PI / 180;
        return;
      }

      // 3D 카메라 이동 (우클릭 드래그)
      if (isPanning3D.current && Mode3D) {
        const dx = e.clientX - cam3DStart.current.x;
        const dy = e.clientY - cam3DStart.current.y;
        const panSpeed = 2.0;
        const yawRad = (Mode3D._yawRad || 0);
        // yaw 방향에 맞게 회전된 이동 벡터
        const cosYaw = Math.cos(yawRad);
        const sinYaw = Math.sin(yawRad);
        Mode3D._editorPanX = cam3DStart.current.panX - (dx * cosYaw + dy * sinYaw) * panSpeed;
        Mode3D._editorPanY = cam3DStart.current.panY - (-dx * sinYaw + dy * cosYaw) * panSpeed;
        return;
      }

      // 2D 패닝
      if (!isPanning.current) return;
      el.scrollLeft = panStart.current.scrollLeft - (e.clientX - panStart.current.x);
      el.scrollTop = panStart.current.scrollTop - (e.clientY - panStart.current.y);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1 && isRotating3D.current) {
        isRotating3D.current = false;
        isPanning.current = false;
        setPanning(false);
        return;
      }
      if (e.button === 2 && isPanning3D.current) {
        isPanning3D.current = false;
        isPanning.current = false;
        setPanning(false);
        return;
      }
      if (e.button !== 1 || !isPanning.current) return;
      isPanning.current = false;
      setPanning(false);
    };

    // 3D 모드에서 우클릭 드래그 중 컨텍스트 메뉴 방지
    const handleContextMenu = (e: MouseEvent) => {
      if (isPanning3D.current || useEditorStore.getState().mode3d) {
        e.preventDefault();
      }
    };

    el.addEventListener('mousedown', handleMouseDown);
    el.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('mousedown', handleMouseDown);
      el.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [zoomIn, zoomOut]);

  // Tile ID debug toggle
  useEffect(() => {
    const handler = (e: Event) => setShowTileId((e as CustomEvent<boolean>).detail);
    window.addEventListener('editor-toggle-tileid', handler);
    return () => window.removeEventListener('editor-toggle-tileid', handler);
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
      if (lightEditMode) {
        if (selectedLightIds.length > 0) {
          deleteLights(selectedLightIds);
          showToast(`조명 ${selectedLightIds.length}개 삭제됨`);
        } else if (selectedLightId != null) {
          deletePointLight(selectedLightId);
          setSelectedLightId(null);
        }
        return;
      }
      if (editMode === 'object') {
        if (selectedObjectIds.length > 0) {
          deleteObjects(selectedObjectIds);
          showToast(`오브젝트 ${selectedObjectIds.length}개 삭제됨`);
        } else if (selectedObjectId != null) {
          deleteObject(selectedObjectId);
        }
        return;
      }
      if (editMode === 'event') {
        if (selectedEventIds.length > 0) {
          deleteEvents(selectedEventIds);
          showToast(`이벤트 ${selectedEventIds.length}개 삭제됨`);
        } else if (selectedEventId != null) {
          deleteEvent(selectedEventId);
        }
        return;
      }
      if (editMode === 'cameraZone') {
        if (selectedCameraZoneIds.length > 0) {
          deleteCameraZones(selectedCameraZoneIds);
          showToast(`카메라 영역 ${selectedCameraZoneIds.length}개 삭제됨`);
        } else if (selectedCameraZoneId != null) {
          deleteCameraZone(selectedCameraZoneId);
          showToast('카메라 영역 삭제됨');
        }
        return;
      }
      if (editMode === 'passage') {
        const state = useEditorStore.getState();
        if (state.passageSelectionStart && state.passageSelectionEnd) {
          state.deletePassage(
            state.passageSelectionStart.x, state.passageSelectionStart.y,
            state.passageSelectionEnd.x, state.passageSelectionEnd.y,
          );
          state.clearPassageSelection();
          showToast('통행 선택 영역 삭제됨');
        }
        return;
      }
    };
    window.addEventListener('editor-delete', handleDelete);
    return () => window.removeEventListener('editor-delete', handleDelete);
  }, [editMode, selectedEventId, deleteEvent, lightEditMode, selectedLightId, selectedLightIds, deletePointLight, deleteLights, setSelectedLightId, selectedObjectId, selectedObjectIds, deleteObject, deleteObjects, selectionStart, selectionEnd, deleteTiles, clearSelection, showToast, selectedCameraZoneId, selectedCameraZoneIds, deleteCameraZone, deleteCameraZones]);

  // Handle Copy/Cut/Paste for events, lights, objects, and tile selection
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
      if (lightEditMode) {
        if (selectedLightIds.length > 0) {
          copyLights(selectedLightIds);
          showToast(`조명 ${selectedLightIds.length}개 복사됨`);
        }
        return;
      }
      if (editMode === 'object') {
        if (selectedObjectIds.length > 0) {
          copyObjects(selectedObjectIds);
          showToast(`오브젝트 ${selectedObjectIds.length}개 복사됨`);
        }
        return;
      }
      if (editMode === 'passage') {
        const state = useEditorStore.getState();
        if (state.passageSelectionStart && state.passageSelectionEnd) {
          state.copyPassage(
            state.passageSelectionStart.x, state.passageSelectionStart.y,
            state.passageSelectionEnd.x, state.passageSelectionEnd.y,
          );
          showToast('통행 선택 영역 복사됨');
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
      if (lightEditMode) {
        if (selectedLightIds.length > 0) {
          copyLights(selectedLightIds);
          deleteLights(selectedLightIds);
          showToast(`조명 ${selectedLightIds.length}개 잘라내기`);
        }
        return;
      }
      if (editMode === 'object') {
        if (selectedObjectIds.length > 0) {
          copyObjects(selectedObjectIds);
          deleteObjects(selectedObjectIds);
          showToast(`오브젝트 ${selectedObjectIds.length}개 잘라내기`);
        }
        return;
      }
      if (editMode === 'passage') {
        const state = useEditorStore.getState();
        if (state.passageSelectionStart && state.passageSelectionEnd) {
          state.cutPassage(
            state.passageSelectionStart.x, state.passageSelectionStart.y,
            state.passageSelectionEnd.x, state.passageSelectionEnd.y,
          );
          state.clearPassageSelection();
          showToast('통행 선택 영역 잘라내기');
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
      if (lightEditMode && clipboard?.type === 'lights') {
        setIsLightPasting(true);
        setLightPastePreviewPos({ x: cursorTileX, y: cursorTileY });
        showToast('붙여넣기 모드 - 클릭하여 배치');
        return;
      }
      if (editMode === 'object' && clipboard?.type === 'objects') {
        setIsObjectPasting(true);
        setObjectPastePreviewPos({ x: cursorTileX, y: cursorTileY });
        showToast('붙여넣기 모드 - 클릭하여 배치');
        return;
      }
      if (editMode === 'passage' && clipboard?.type === 'passage') {
        const state = useEditorStore.getState();
        state.setIsPassagePasting(true);
        state.setPassagePastePreviewPos({ x: cursorTileX, y: cursorTileY });
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
  }, [editMode, selectedEventId, selectedEventIds, copyEvent, copyEvents, deleteEvent, deleteEvents, pasteEvent, pasteEvents, clipboard, currentMap, selectionStart, selectionEnd, copyTiles, cutTiles, clearSelection, setIsPasting, setPastePreviewPos, setIsEventPasting, setEventPastePreviewPos, lightEditMode, selectedLightIds, copyLights, deleteLights, setIsLightPasting, setLightPastePreviewPos, selectedObjectIds, copyObjects, deleteObjects, setIsObjectPasting, setObjectPastePreviewPos, cursorTileX, cursorTileY, showToast]);

  // Handle Select All (Cmd+A)
  useEffect(() => {
    const handleSelectAll = () => {
      if (editMode === 'map' && currentMap) {
        if (selectedTool !== 'select') {
          setSelectedTool('select');
        }
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
      if (lightEditMode && currentMap?.editorLights?.points) {
        const allIds = currentMap.editorLights.points.map(l => l.id);
        useEditorStore.getState().setSelectedLightIds(allIds);
        showToast(`전체 선택 (조명 ${allIds.length}개)`);
      }
      if (editMode === 'object' && currentMap?.objects) {
        const allIds = currentMap.objects.map(o => o.id);
        useEditorStore.getState().setSelectedObjectIds(allIds);
        showToast(`전체 선택 (오브젝트 ${allIds.length}개)`);
      }
      if (editMode === 'cameraZone' && currentMap?.cameraZones) {
        const allIds = currentMap.cameraZones.map(z => z.id);
        useEditorStore.getState().setSelectedCameraZoneIds(allIds);
        if (allIds.length > 0) useEditorStore.getState().setSelectedCameraZoneId(allIds[0]);
        showToast(`전체 선택 (카메라 영역 ${allIds.length}개)`);
      }
      if (editMode === 'passage' && currentMap) {
        const state = useEditorStore.getState();
        if (state.passageTool !== 'select') {
          state.setPassageTool('select');
        }
        state.setPassageSelection({ x: 0, y: 0 }, { x: currentMap.width - 1, y: currentMap.height - 1 });
        showToast('전체 선택');
      }
    };
    window.addEventListener('editor-selectall', handleSelectAll);
    return () => window.removeEventListener('editor-selectall', handleSelectAll);
  }, [editMode, selectedTool, setSelectedTool, currentMap, setSelection, showToast, lightEditMode]);

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
      if (lightEditMode) {
        if (isLightPasting) {
          setIsLightPasting(false);
          setLightPastePreviewPos(null);
        }
        clearLightSelection();
      }
      if (editMode === 'object') {
        if (isObjectPasting) {
          setIsObjectPasting(false);
          setObjectPastePreviewPos(null);
        }
        clearObjectSelection();
      }
      if (editMode === 'cameraZone') {
        useEditorStore.getState().setSelectedCameraZoneIds([]);
        useEditorStore.getState().setSelectedCameraZoneId(null);
      }
      if (editMode === 'passage') {
        const state = useEditorStore.getState();
        if (state.isPassagePasting) {
          state.setIsPassagePasting(false);
          state.setPassagePastePreviewPos(null);
        }
        state.clearPassageSelection();
      }
    };
    window.addEventListener('editor-deselect', handleDeselect);
    return () => window.removeEventListener('editor-deselect', handleDeselect);
  }, [editMode, isPasting, isEventPasting, isLightPasting, isObjectPasting, setIsPasting, setPastePreviewPos, clearSelection, setIsEventPasting, setEventPastePreviewPos, clearEventSelection, lightEditMode, setIsLightPasting, setLightPastePreviewPos, clearLightSelection, setIsObjectPasting, setObjectPastePreviewPos, clearObjectSelection]);

  // Handle Escape key for selection/paste cancel
  useEffect(() => {
    const handleEscape = () => {
      // Passage 모드
      const pState = useEditorStore.getState();
      if (pState.isPassagePasting) {
        pState.setIsPassagePasting(false);
        pState.setPassagePastePreviewPos(null);
        return;
      }
      if (pState.passageSelectionStart || pState.passageSelectionEnd) {
        pState.clearPassageSelection();
        return;
      }
      if (isEventPasting) {
        setIsEventPasting(false);
        setEventPastePreviewPos(null);
        return;
      }
      if (isLightPasting) {
        setIsLightPasting(false);
        setLightPastePreviewPos(null);
        return;
      }
      if (isObjectPasting) {
        setIsObjectPasting(false);
        setObjectPastePreviewPos(null);
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
        return;
      }
      if (state.selectedLightIds.length > 0) {
        clearLightSelection();
        return;
      }
      if (state.selectedObjectIds.length > 0) {
        clearObjectSelection();
        return;
      }
    };
    window.addEventListener('editor-escape', handleEscape);
    return () => window.removeEventListener('editor-escape', handleEscape);
  }, [isPasting, isEventPasting, isLightPasting, isObjectPasting, selectionStart, selectionEnd, setIsPasting, setPastePreviewPos, clearSelection, setIsEventPasting, setEventPastePreviewPos, clearEventSelection, setIsLightPasting, setLightPastePreviewPos, clearLightSelection, setIsObjectPasting, setObjectPastePreviewPos, clearObjectSelection]);

  return { showGrid, showTileId, altPressed, panning };
}
