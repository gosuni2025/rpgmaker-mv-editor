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

  // =========================================================================
  // 3D 카메라 조작 (유니티 Scene View 스타일)
  // - 우클릭 드래그: 카메라 회전 (Flythrough)
  // - 우클릭 + WASD/QE: FPS 이동
  // - 중클릭 드래그: 팬 (카메라 이동)
  // - Alt + 좌클릭 드래그: 공전 (Orbit)
  // - 마우스 휠: 줌
  // =========================================================================
  const isRotating3D = useRef(false);  // 우클릭 드래그: 카메라 회전
  const isPanning3D = useRef(false);   // 중클릭 드래그: 팬
  const isOrbiting3D = useRef(false);  // Alt+좌클릭: 공전
  const cam3DStart = useRef({ x: 0, y: 0, tiltDeg: 0, yawDeg: 0, panX: 0, panY: 0, panZ: 0 });
  // FPS 이동 키 상태
  const flyKeys = useRef<Set<string>>(new Set());
  const flyAnimRef = useRef<number>(0);

  // Mouse wheel zoom & middle click panning / 3D camera controls
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const Mode3D = (window as any).Mode3D;

    const handleWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest?.('.db-dialog-overlay')) return;
      e.preventDefault();

      const is3D = useEditorStore.getState().mode3d;

      // 3D 모드: 유니티 스타일 — 카메라 forward 벡터 방향으로 전진/후진
      if (is3D && Mode3D) {
        const cam = Mode3D._perspCamera;
        if (!cam) return;
        const moveSpeed = 80;
        const dir = e.deltaY < 0 ? 1 : -1;
        const fwd = new (window as any).THREE.Vector3();
        cam.getWorldDirection(fwd);
        Mode3D._editorPanX = (Mode3D._editorPanX || 0) + fwd.x * dir * moveSpeed;
        Mode3D._editorPanY = (Mode3D._editorPanY || 0) + fwd.y * dir * moveSpeed;
        Mode3D._editorPanZ = (Mode3D._editorPanZ || 0) + fwd.z * dir * moveSpeed;
        return;
      }

      // 2D 모드: 마우스 커서 기준 줌
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const oldZoom = useEditorStore.getState().zoomLevel;

      if (e.deltaY < 0) zoomIn();
      else if (e.deltaY > 0) zoomOut();

      const newZoom = useEditorStore.getState().zoomLevel;
      if (newZoom === oldZoom) return;

      const contentX = (el.scrollLeft + mouseX) / oldZoom;
      const contentY = (el.scrollTop + mouseY) / oldZoom;
      el.scrollLeft = contentX * newZoom - mouseX;
      el.scrollTop = contentY * newZoom - mouseY;
    };
    el.addEventListener('wheel', handleWheel, { passive: false });

    // --- FPS 이동 루프 (우클릭 + WASD/QE) ---
    const startFlyLoop = () => {
      if (flyAnimRef.current) return;
      let lastTime = performance.now();
      const loop = () => {
        if (!isRotating3D.current || !Mode3D) {
          flyAnimRef.current = 0;
          return;
        }
        const cam = Mode3D._perspCamera;
        if (!cam) { flyAnimRef.current = requestAnimationFrame(loop); return; }
        const now = performance.now();
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        const speed = 400; // px/sec
        const THREE = (window as any).THREE;

        // 카메라에서 forward/right/up 벡터 직접 추출
        const fwd = new THREE.Vector3();
        cam.getWorldDirection(fwd);
        const right = new THREE.Vector3();
        right.crossVectors(fwd, cam.up).normalize();
        const up = new THREE.Vector3(0, 0, 1); // 월드 Z-up (높이)

        let dx = 0, dy = 0, dz = 0;
        // W/S: 카메라 forward 방향
        if (flyKeys.current.has('w')) { dx += fwd.x; dy += fwd.y; dz += fwd.z; }
        if (flyKeys.current.has('s')) { dx -= fwd.x; dy -= fwd.y; dz -= fwd.z; }
        // A/D: 카메라 right 방향
        if (flyKeys.current.has('a')) { dx -= right.x; dy -= right.y; dz -= right.z; }
        if (flyKeys.current.has('d')) { dx += right.x; dy += right.y; dz += right.z; }
        // Q/E: 월드 높이 (Z축)
        if (flyKeys.current.has('e')) { dz += 1; }
        if (flyKeys.current.has('q')) { dz -= 1; }

        if (dx !== 0 || dy !== 0 || dz !== 0) {
          Mode3D._editorPanX = (Mode3D._editorPanX || 0) + dx * speed * dt;
          Mode3D._editorPanY = (Mode3D._editorPanY || 0) + dy * speed * dt;
          Mode3D._editorPanZ = (Mode3D._editorPanZ || 0) + dz * speed * dt;
        }
        flyAnimRef.current = requestAnimationFrame(loop);
      };
      flyAnimRef.current = requestAnimationFrame(loop);
    };

    const stopFlyLoop = () => {
      if (flyAnimRef.current) {
        cancelAnimationFrame(flyAnimRef.current);
        flyAnimRef.current = 0;
      }
      flyKeys.current.clear();
    };

    // WASD/QE 키 핸들러 (우클릭 누른 상태에서만)
    // e.code 사용: IME(한글) 입력 중에도 물리 키 감지
    const codeToFlyKey: Record<string, string> = {
      KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyQ: 'q', KeyE: 'e',
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isRotating3D.current) return;
      const k = codeToFlyKey[e.code];
      if (k) {
        e.preventDefault();
        flyKeys.current.add(k);
        startFlyLoop();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const k = codeToFlyKey[e.code];
      if (k) flyKeys.current.delete(k);
    };

    const handleMouseDown = (e: MouseEvent) => {
      const is3D = useEditorStore.getState().mode3d;

      // 3D 모드: 우클릭 → Flythrough (카메라 회전 + WASD 이동)
      if (e.button === 2 && is3D && Mode3D) {
        e.preventDefault();
        isRotating3D.current = true;
        isPanning.current = true;
        setPanning(true);
        cam3DStart.current = {
          x: e.clientX, y: e.clientY,
          tiltDeg: Mode3D._tiltDeg, yawDeg: Mode3D._yawDeg,
          panX: 0, panY: 0, panZ: 0,
        };
        return;
      }

      // 3D 모드: 중클릭 → 팬 (카메라 이동)
      if (e.button === 1 && is3D && Mode3D) {
        e.preventDefault();
        isPanning3D.current = true;
        isPanning.current = true;
        setPanning(true);
        cam3DStart.current = {
          x: e.clientX, y: e.clientY,
          tiltDeg: 0, yawDeg: 0,
          panX: Mode3D._editorPanX || 0,
          panY: Mode3D._editorPanY || 0,
          panZ: Mode3D._editorPanZ || 0,
        };
        return;
      }

      // 3D 모드: Alt + 좌클릭 → 공전 (Orbit)
      if (e.button === 0 && e.altKey && is3D && Mode3D) {
        e.preventDefault();
        isOrbiting3D.current = true;
        isPanning.current = true;
        setPanning(true);
        cam3DStart.current = {
          x: e.clientX, y: e.clientY,
          tiltDeg: Mode3D._tiltDeg, yawDeg: Mode3D._yawDeg,
          panX: 0, panY: 0, panZ: 0,
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
      // 3D Flythrough 회전 (우클릭 드래그)
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

      // 3D 공전 (Alt+좌클릭 드래그) — 유니티와 동일하게 동작
      if (isOrbiting3D.current && Mode3D) {
        const dx = e.clientX - cam3DStart.current.x;
        const dy = e.clientY - cam3DStart.current.y;
        const sensitivity = 0.3;
        Mode3D._yawDeg = cam3DStart.current.yawDeg + dx * sensitivity;
        Mode3D._yawRad = Mode3D._yawDeg * Math.PI / 180;
        Mode3D._tiltDeg = Math.max(5, Math.min(89, cam3DStart.current.tiltDeg - dy * sensitivity));
        Mode3D._tiltRad = Mode3D._tiltDeg * Math.PI / 180;
        return;
      }

      // 3D 팬 (중클릭 드래그) — 카메라 right/up 벡터 사용
      if (isPanning3D.current && Mode3D) {
        const cam = Mode3D._perspCamera;
        if (!cam) return;
        const dx = e.clientX - cam3DStart.current.x;
        const dy = e.clientY - cam3DStart.current.y;
        const panSpeed = 2.0;
        const THREE = (window as any).THREE;
        const fwd = new THREE.Vector3();
        cam.getWorldDirection(fwd);
        const right = new THREE.Vector3();
        right.crossVectors(fwd, cam.up).normalize();
        const up = new THREE.Vector3();
        up.crossVectors(right, fwd).normalize();
        Mode3D._editorPanX = cam3DStart.current.panX - (dx * right.x + dy * -up.x) * panSpeed;
        Mode3D._editorPanY = cam3DStart.current.panY - (dx * right.y + dy * -up.y) * panSpeed;
        Mode3D._editorPanZ = cam3DStart.current.panZ - (dx * right.z + dy * -up.z) * panSpeed;
        return;
      }

      // 2D 패닝
      if (!isPanning.current) return;
      el.scrollLeft = panStart.current.scrollLeft - (e.clientX - panStart.current.x);
      el.scrollTop = panStart.current.scrollTop - (e.clientY - panStart.current.y);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2 && isRotating3D.current) {
        isRotating3D.current = false;
        isPanning.current = false;
        setPanning(false);
        stopFlyLoop();
        return;
      }
      if (e.button === 1 && isPanning3D.current) {
        isPanning3D.current = false;
        isPanning.current = false;
        setPanning(false);
        return;
      }
      if (e.button === 0 && isOrbiting3D.current) {
        isOrbiting3D.current = false;
        isPanning.current = false;
        setPanning(false);
        return;
      }
      if (e.button !== 1 || !isPanning.current) return;
      isPanning.current = false;
      setPanning(false);
    };

    // 3D 모드에서 우클릭 컨텍스트 메뉴 방지
    const handleContextMenu = (e: MouseEvent) => {
      if (isRotating3D.current || useEditorStore.getState().mode3d) {
        e.preventDefault();
      }
    };

    el.addEventListener('mousedown', handleMouseDown);
    el.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('mousedown', handleMouseDown);
      el.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      stopFlyLoop();
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
