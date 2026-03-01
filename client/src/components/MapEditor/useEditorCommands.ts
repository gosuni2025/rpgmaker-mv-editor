import { useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';

export function useEditorCommands() {
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

  const selectedLightIds = useEditorStore((s) => s.selectedLightIds);
  const copyLights = useEditorStore((s) => s.copyLights);
  const deleteLights = useEditorStore((s) => s.deleteLights);
  const isLightPasting = useEditorStore((s) => s.isLightPasting);
  const setIsLightPasting = useEditorStore((s) => s.setIsLightPasting);
  const setLightPastePreviewPos = useEditorStore((s) => s.setLightPastePreviewPos);
  const clearLightSelection = useEditorStore((s) => s.clearLightSelection);

  const selectedObjectIds = useEditorStore((s) => s.selectedObjectIds);
  const copyObjects = useEditorStore((s) => s.copyObjects);
  const deleteObjects = useEditorStore((s) => s.deleteObjects);
  const isObjectPasting = useEditorStore((s) => s.isObjectPasting);
  const setIsObjectPasting = useEditorStore((s) => s.setIsObjectPasting);
  const setObjectPastePreviewPos = useEditorStore((s) => s.setObjectPastePreviewPos);
  const clearObjectSelection = useEditorStore((s) => s.clearObjectSelection);
  const clearObjectBrush = useEditorStore((s) => s.clearObjectBrush);

  const selectedCameraZoneId = useEditorStore((s) => s.selectedCameraZoneId);
  const selectedCameraZoneIds = useEditorStore((s) => s.selectedCameraZoneIds);
  const deleteCameraZone = useEditorStore((s) => s.deleteCameraZone);
  const deleteCameraZones = useEditorStore((s) => s.deleteCameraZones);

  // Handle Delete key
  useEffect(() => {
    const handleDelete = () => {
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
        const selStart = useEditorStore.getState().selectedStartPosition;
        if (selStart === 'player') {
          showToast('플레이어 시작 위치는 삭제할 수 없습니다');
          return;
        }
        if (selStart) {
          const clearVehicle = useEditorStore.getState().clearVehicleStartPosition;
          clearVehicle(selStart);
          useEditorStore.getState().setSelectedStartPosition(null);
          showToast(`${selStart === 'boat' ? '보트' : selStart === 'ship' ? '선박' : '비행선'} 초기 위치 해제됨`);
          return;
        }
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

  // Handle Copy/Cut/Paste
  useEffect(() => {
    const handleCopy = () => {
      if (editMode === 'map' && selectionStart && selectionEnd) {
        copyTiles(selectionStart.x, selectionStart.y, selectionEnd.x, selectionEnd.y);
        const w = Math.abs(selectionEnd.x - selectionStart.x) + 1;
        const h = Math.abs(selectionEnd.y - selectionStart.y) + 1;
        const sx = Math.min(selectionStart.x, selectionEnd.x);
        const sy = Math.min(selectionStart.y, selectionEnd.y);
        showToast(`타일 복사됨: ${w}×${h} 영역 (${sx},${sy})`);
        return;
      }
      if (editMode === 'event') {
        if (selectedEventIds.length > 0) {
          copyEvents(selectedEventIds);
          const names = selectedEventIds
            .map(id => currentMap?.events?.[id]?.name || `EV${String(id).padStart(3, '0')}`)
            .join(', ');
          showToast(`이벤트 ${selectedEventIds.length}개 복사됨: ${names}`);
        } else if (selectedEventId != null) {
          copyEvent(selectedEventId);
          const name = currentMap?.events?.[selectedEventId]?.name || `EV${String(selectedEventId).padStart(3, '0')}`;
          showToast(`이벤트 복사됨: "${name}" (ID: ${selectedEventId})`);
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
        const result = pasteEvents(cursorTileX, cursorTileY);
        if (result.pastedCount === 0 && result.blockedPositions > 0) {
          showToast('해당 위치에 붙여넣을 수 없습니다 (이미 이벤트가 있음)');
        } else if (result.pastedCount > 0 && result.blockedPositions > 0) {
          showToast(`이벤트 ${result.pastedCount}개 붙여넣기 (${result.blockedPositions}개 위치 충돌로 건너뜀)`);
        } else if (result.pastedCount > 0) {
          showToast(`이벤트 ${result.pastedCount}개 붙여넣기 완료`);
        }
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
  }, [editMode, selectedEventId, selectedEventIds, copyEvent, copyEvents, deleteEvent, deleteEvents, pasteEvents, clipboard, currentMap, selectionStart, selectionEnd, copyTiles, cutTiles, clearSelection, setIsPasting, setPastePreviewPos, setIsEventPasting, setEventPastePreviewPos, lightEditMode, selectedLightIds, copyLights, deleteLights, setIsLightPasting, setLightPastePreviewPos, selectedObjectIds, copyObjects, deleteObjects, setIsObjectPasting, setObjectPastePreviewPos, cursorTileX, cursorTileY, showToast]);

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

  // Handle Escape key
  useEffect(() => {
    const handleEscape = () => {
      const pState = useEditorStore.getState();
      if (pState.objectBrushTiles) {
        pState.clearObjectBrush();
        return;
      }
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
  }, [isPasting, isEventPasting, isLightPasting, isObjectPasting, selectionStart, selectionEnd, setIsPasting, setPastePreviewPos, clearSelection, setIsEventPasting, setEventPastePreviewPos, clearEventSelection, setIsLightPasting, setLightPastePreviewPos, clearLightSelection, setIsObjectPasting, setObjectPastePreviewPos, clearObjectSelection, clearObjectBrush]);

  // 브러시 모드 ESC 취소: editor-escape 이벤트 경로에 무관하게 직접 keydown 처리
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const state = useEditorStore.getState();
      if (state.objectBrushTiles) {
        state.clearObjectBrush();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', onKeyDown, true); // capture phase로 최우선 처리
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
