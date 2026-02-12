import React, { useRef, useMemo } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { TileChange } from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import EventDetail from '../EventEditor/EventDetail';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useThreeRenderer, type DragPreviewInfo } from './useThreeRenderer';
import { useMapTools } from './useMapTools';
import { useMouseHandlers } from './useMouseHandlers';


export default function MapCanvas() {
  // DOM refs
  const containerRef = useRef<HTMLDivElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const parallaxDivRef = useRef<HTMLDivElement>(null);

  // Shared refs for drawing state
  const pendingChanges = useRef<TileChange[]>([]);
  const shadowPaintMode = useRef<boolean>(true);
  const shadowPainted = useRef<Set<string>>(new Set());

  // Store subscriptions (only what JSX needs directly)
  const currentMap = useEditorStore((s) => s.currentMap);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const editMode = useEditorStore((s) => s.editMode);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const selectedTileId = useEditorStore((s) => s.selectedTileId);
  const selectedTiles = useEditorStore((s) => s.selectedTiles);
  const selectedTilesWidth = useEditorStore((s) => s.selectedTilesWidth);
  const selectedTilesHeight = useEditorStore((s) => s.selectedTilesHeight);
  const clipboard = useEditorStore((s) => s.clipboard);
  const selectionStart = useEditorStore((s) => s.selectionStart);
  const selectionEnd = useEditorStore((s) => s.selectionEnd);
  const isPasting = useEditorStore((s) => s.isPasting);
  const pastePreviewPos = useEditorStore((s) => s.pastePreviewPos);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const systemData = useEditorStore((s) => s.systemData);
  const setPlayerStartPosition = useEditorStore((s) => s.setPlayerStartPosition);
  const copyEvent = useEditorStore((s) => s.copyEvent);
  const deleteEvent = useEditorStore((s) => s.deleteEvent);
  const pasteEvent = useEditorStore((s) => s.pasteEvent);
  const selectedCameraZoneId = useEditorStore((s) => s.selectedCameraZoneId);

  // Compose hooks
  const { showGrid, altPressed, panning } = useKeyboardShortcuts(containerRef);

  // Mouse handlers first (to get drag previews for Three.js renderer)
  // We need a forward declaration pattern: tools needs renderer refs, renderer needs drag previews
  // Solution: create renderer first with empty drag previews, then tools, then handlers
  // But handlers produce drag previews... we use useMemo to build dragPreviews from state

  const {
    rendererObjRef, tilemapRef, stageRef, renderRequestedRef, toolPreviewMeshesRef,
    startPosMeshesRef, rendererReady,
  } = useThreeRenderer(webglCanvasRef, showGrid, []); // dragPreviews filled via useEffect

  const tools = useMapTools(
    webglCanvasRef, pendingChanges, shadowPaintMode, shadowPainted,
    toolPreviewMeshesRef, rendererObjRef, stageRef, renderRequestedRef,
  );

  const selectedEventIds = useEditorStore((s) => s.selectedEventIds);
  const eventSelectionStart = useEditorStore((s) => s.eventSelectionStart);
  const eventSelectionEnd = useEditorStore((s) => s.eventSelectionEnd);
  const isEventPasting = useEditorStore((s) => s.isEventPasting);
  const eventPastePreviewPos = useEditorStore((s) => s.eventPastePreviewPos);
  const copyEvents = useEditorStore((s) => s.copyEvents);
  const deleteEvents = useEditorStore((s) => s.deleteEvents);
  const pasteEvents = useEditorStore((s) => s.pasteEvents);

  const selectedLightIds = useEditorStore((s) => s.selectedLightIds);
  const lightSelectionStart = useEditorStore((s) => s.lightSelectionStart);
  const lightSelectionEnd = useEditorStore((s) => s.lightSelectionEnd);
  const isLightPasting = useEditorStore((s) => s.isLightPasting);
  const lightPastePreviewPos = useEditorStore((s) => s.lightPastePreviewPos);
  const selectedObjectIds = useEditorStore((s) => s.selectedObjectIds);
  const objectSelectionStart = useEditorStore((s) => s.objectSelectionStart);
  const objectSelectionEnd = useEditorStore((s) => s.objectSelectionEnd);
  const isObjectPasting = useEditorStore((s) => s.isObjectPasting);
  const objectPastePreviewPos = useEditorStore((s) => s.objectPastePreviewPos);
  const lightEditMode = useEditorStore((s) => s.lightEditMode);

  const {
    handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave,
    handleDoubleClick, handleContextMenu, createNewEvent,
    resizePreview, resizeCursor, dragPreview, eventMultiDragDelta,
    lightMultiDragDelta, objectMultiDragDelta,
    lightDragPreview, objectDragPreview, cameraZoneDragPreview, hoverTile,
    eventCtxMenu, editingEventId, setEditingEventId,
    closeEventCtxMenu,
    isDraggingEvent, isDraggingLight, isDraggingObject, draggedObjectId,
    isResizing, resizeOrigSize, isSelectingEvents,
    isSelectingLights, isSelectingObjects,
    isDraggingCameraZone, isCreatingCameraZone, isResizingCameraZone, cameraZoneCursor,
    playerStartDragPos,
  } = useMouseHandlers(webglCanvasRef, tools, pendingChanges);

  // Build drag previews for Three.js
  const dragPreviews = useMemo<DragPreviewInfo[]>(() => {
    const result: DragPreviewInfo[] = [];
    // Multi-event drag preview: show ghost for each selected event
    if (eventMultiDragDelta && currentMap?.events && selectedEventIds.length > 0) {
      for (const evId of selectedEventIds) {
        const ev = currentMap.events.find(e => e && e.id === evId);
        if (ev) {
          result.push({
            type: 'event',
            x: ev.x + eventMultiDragDelta.dx,
            y: ev.y + eventMultiDragDelta.dy,
          });
        }
      }
    }
    // Multi-light drag preview
    if (lightMultiDragDelta && currentMap?.editorLights?.points && selectedLightIds.length > 0) {
      for (const lid of selectedLightIds) {
        const light = currentMap.editorLights.points.find(p => p.id === lid);
        if (light) {
          result.push({
            type: 'light',
            x: light.x + lightMultiDragDelta.dx,
            y: light.y + lightMultiDragDelta.dy,
          });
        }
      }
    } else if (lightDragPreview && isDraggingLight.current) {
      result.push({ type: 'light', x: lightDragPreview.x, y: lightDragPreview.y });
    }
    // Multi-object drag preview
    if (objectMultiDragDelta && currentMap?.objects && selectedObjectIds.length > 0) {
      for (const oid of selectedObjectIds) {
        const obj = (currentMap.objects as any[]).find(o => o.id === oid);
        if (obj) {
          result.push({
            type: 'object',
            x: obj.x + objectMultiDragDelta.dx,
            y: obj.y + objectMultiDragDelta.dy,
            width: obj.width,
            height: obj.height,
          });
        }
      }
    } else if (objectDragPreview && isDraggingObject.current && draggedObjectId.current != null) {
      const obj = currentMap?.objects?.find((o: any) => o.id === draggedObjectId.current);
      if (obj) {
        result.push({
          type: 'object',
          x: objectDragPreview.x,
          y: objectDragPreview.y,
          width: obj.width,
          height: obj.height,
        });
      }
    }
    return result;
  }, [eventMultiDragDelta, selectedEventIds, lightMultiDragDelta, selectedLightIds, objectMultiDragDelta, selectedObjectIds, lightDragPreview, objectDragPreview, currentMap?.objects, currentMap?.events, currentMap?.editorLights?.points]);

  // Sync drag previews to Three.js renderer
  React.useEffect(() => {
    const rObj = rendererObjRef.current;
    if (!rObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    // Access the drag preview meshes ref from renderer
    const meshesRef = (rendererObjRef as any)._dragPreviewMeshesRef;
    // We handle this inline since useThreeRenderer already has the effect
    // Actually, let's manually manage it here since we couldn't pass dragPreviews reactively to useThreeRenderer

    // Dispose existing drag preview meshes
    const scene = rObj.scene;
    if (!(window as any)._editorDragMeshes) (window as any)._editorDragMeshes = [];
    const existing = (window as any)._editorDragMeshes as any[];
    for (const m of existing) {
      scene.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
    existing.length = 0;

    for (const dp of dragPreviews) {
      let fillColor: number, strokeColor: number;
      let dpW = 1, dpH = 1;
      if (dp.type === 'event') {
        fillColor = 0x00b450; strokeColor = 0x00ff00;
      } else if (dp.type === 'light') {
        fillColor = 0xffcc88; strokeColor = 0xffcc88;
      } else {
        fillColor = 0x00ff66; strokeColor = 0x00ff66;
        dpW = dp.width || 1;
        dpH = dp.height || 1;
      }

      const geom = new THREE.PlaneGeometry(TILE_SIZE_PX * dpW, TILE_SIZE_PX * dpH);
      const mat = new THREE.MeshBasicMaterial({
        color: fillColor, opacity: 0.4, transparent: true, depthTest: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geom, mat);
      const cx = dp.x * TILE_SIZE_PX + TILE_SIZE_PX * dpW / 2;
      const cy = dp.type === 'object'
        ? (dp.y - dpH + 1) * TILE_SIZE_PX + TILE_SIZE_PX * dpH / 2
        : dp.y * TILE_SIZE_PX + TILE_SIZE_PX * dpH / 2;
      mesh.position.set(cx, cy, 6);
      mesh.renderOrder = 10000;
      mesh.frustumCulled = false;
      mesh.userData.editorGrid = true;
      scene.add(mesh);
      existing.push(mesh);

      const hw = TILE_SIZE_PX * dpW / 2;
      const hh = TILE_SIZE_PX * dpH / 2;
      const pts = [
        new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
        new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
        new THREE.Vector3(-hw, -hh, 0),
      ];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({
        color: strokeColor, depthTest: false, transparent: true, opacity: 1.0,
      });
      const line = new THREE.Line(lineGeom, lineMat);
      line.position.set(cx, cy, 6.5);
      line.renderOrder = 10001;
      line.frustumCulled = false;
      line.userData.editorGrid = true;
      scene.add(line);
      existing.push(line);
    }

    // Trigger render
    if (!renderRequestedRef.current) {
      renderRequestedRef.current = true;
      requestAnimationFrame(() => {
        renderRequestedRef.current = false;
        if (!rendererObjRef.current) return;
        const strategy = (window as any).RendererStrategy?.getStrategy();
        if (strategy && stageRef.current) strategy.render(rendererObjRef.current, stageRef.current);
      });
    }
  }, [dragPreviews, rendererReady]);

  // =========================================================================
  // Camera Zone overlays cleanup (Three.js → HTML로 이동, 기존 메시 정리만)
  // =========================================================================
  React.useEffect(() => {
    const rObj = rendererObjRef.current;
    if (!rObj) return;

    // Dispose existing camera zone meshes (Three.js → HTML 전환 시 정리)
    if (!(window as any)._editorCameraZoneMeshes) (window as any)._editorCameraZoneMeshes = [];
    const existing = (window as any)._editorCameraZoneMeshes as any[];
    for (const m of existing) {
      rObj.scene.remove(m);
      m.geometry?.dispose();
      if (m.material?.map) m.material.map.dispose();
      m.material?.dispose();
    }
    existing.length = 0;

    // Trigger render to clear old meshes
    if (!renderRequestedRef.current) {
      renderRequestedRef.current = true;
      requestAnimationFrame(() => {
        renderRequestedRef.current = false;
        if (!rendererObjRef.current || !stageRef.current) return;
        const strategy = (window as any).RendererStrategy?.getStrategy();
        if (strategy) strategy.render(rendererObjRef.current, stageRef.current);
      });
    }
  }, [editMode, rendererReady]);

  // =========================================================================
  // Selection rectangle overlay (선택 영역 오버레이)
  // =========================================================================
  React.useEffect(() => {
    const rObj = rendererObjRef.current;
    if (!rObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    // Dispose existing selection meshes
    if (!(window as any)._editorSelectionMeshes) (window as any)._editorSelectionMeshes = [];
    const existing = (window as any)._editorSelectionMeshes as any[];
    for (const m of existing) {
      rObj.scene.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
    existing.length = 0;

    if (!selectionStart || !selectionEnd) {
      // 렌더 트리거
      if (!renderRequestedRef.current) {
        renderRequestedRef.current = true;
        requestAnimationFrame(() => {
          renderRequestedRef.current = false;
          if (!rendererObjRef.current || !stageRef.current) return;
          const strategy = (window as any).RendererStrategy?.getStrategy();
          if (strategy) strategy.render(rendererObjRef.current, stageRef.current);
        });
      }
      return;
    }

    const minX = Math.min(selectionStart.x, selectionEnd.x);
    const maxX = Math.max(selectionStart.x, selectionEnd.x);
    const minY = Math.min(selectionStart.y, selectionEnd.y);
    const maxY = Math.max(selectionStart.y, selectionEnd.y);

    const rw = (maxX - minX + 1) * TILE_SIZE_PX;
    const rh = (maxY - minY + 1) * TILE_SIZE_PX;
    const cx = minX * TILE_SIZE_PX + rw / 2;
    const cy = minY * TILE_SIZE_PX + rh / 2;

    // 반투명 채우기
    const geom = new THREE.PlaneGeometry(rw, rh);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00bfff, opacity: 0.15, transparent: true,
      depthTest: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(cx, cy, 6.5);
    mesh.renderOrder = 10004;
    mesh.frustumCulled = false;
    mesh.userData.editorGrid = true;
    rObj.scene.add(mesh);
    existing.push(mesh);

    // 점선 테두리
    const hw = rw / 2, hh = rh / 2;
    const pts = [
      new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
      new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
      new THREE.Vector3(-hw, -hh, 0),
    ];
    const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x00bfff, depthTest: false, transparent: true,
      opacity: 1.0, dashSize: 6, gapSize: 4,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    line.computeLineDistances();
    line.position.set(cx, cy, 6.8);
    line.renderOrder = 10005;
    line.frustumCulled = false;
    line.userData.editorGrid = true;
    rObj.scene.add(line);
    existing.push(line);

    // 렌더 트리거
    if (!renderRequestedRef.current) {
      renderRequestedRef.current = true;
      requestAnimationFrame(() => {
        renderRequestedRef.current = false;
        if (!rendererObjRef.current || !stageRef.current) return;
        const strategy = (window as any).RendererStrategy?.getStrategy();
        if (strategy) strategy.render(rendererObjRef.current, stageRef.current);
      });
    }
  }, [selectionStart, selectionEnd, rendererReady]);

  // =========================================================================
  // Player start position drag preview (시작 위치 드래그 시 위치 이동)
  // =========================================================================
  React.useEffect(() => {
    const meshes = startPosMeshesRef.current;
    if (!meshes || meshes.length === 0 || !systemData || currentMapId !== systemData.startMapId) return;
    const origX = systemData.startX;
    const origY = systemData.startY;
    if (playerStartDragPos) {
      const dx = (playerStartDragPos.x - origX) * TILE_SIZE_PX;
      const dy = (playerStartDragPos.y - origY) * TILE_SIZE_PX;
      for (const m of meshes) {
        if (m._origPos === undefined) {
          m._origPos = { x: m.position.x, y: m.position.y };
        }
        m.position.x = m._origPos.x + dx;
        m.position.y = m._origPos.y + dy;
      }
    } else {
      for (const m of meshes) {
        if (m._origPos !== undefined) {
          m.position.x = m._origPos.x;
          m.position.y = m._origPos.y;
          delete m._origPos;
        }
      }
    }
    if (!renderRequestedRef.current) {
      renderRequestedRef.current = true;
      requestAnimationFrame(() => {
        renderRequestedRef.current = false;
        if (!rendererObjRef.current || !stageRef.current) return;
        const strategy = (window as any).RendererStrategy?.getStrategy();
        if (strategy) strategy.render(rendererObjRef.current, stageRef.current);
      });
    }
  }, [playerStartDragPos, systemData, currentMapId, rendererReady]);

  // =========================================================================
  // Event selection overlays (선택된 이벤트 하이라이트 + 드래그 선택 영역)
  // =========================================================================
  React.useEffect(() => {
    const rObj = rendererObjRef.current;
    if (!rObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    // Dispose existing
    if (!(window as any)._editorEventSelMeshes) (window as any)._editorEventSelMeshes = [];
    const existing = (window as any)._editorEventSelMeshes as any[];
    for (const m of existing) {
      rObj.scene.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
    existing.length = 0;

    // 1. 선택된 이벤트 하이라이트
    if (editMode === 'event' && selectedEventIds.length > 0 && currentMap?.events) {
      for (const evId of selectedEventIds) {
        const ev = currentMap.events.find(e => e && e.id === evId);
        if (!ev) continue;
        const cx = ev.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const cy = ev.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;

        // 반투명 파란색 채우기
        const geom = new THREE.PlaneGeometry(TILE_SIZE_PX, TILE_SIZE_PX);
        const mat = new THREE.MeshBasicMaterial({
          color: 0x4488ff, opacity: 0.3, transparent: true,
          depthTest: false, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(cx, cy, 5.5);
        mesh.renderOrder = 9998;
        mesh.frustumCulled = false;
        mesh.userData.editorGrid = true;
        rObj.scene.add(mesh);
        existing.push(mesh);

        // 테두리
        const hw = TILE_SIZE_PX / 2;
        const pts = [
          new THREE.Vector3(-hw, -hw, 0), new THREE.Vector3(hw, -hw, 0),
          new THREE.Vector3(hw, hw, 0), new THREE.Vector3(-hw, hw, 0),
          new THREE.Vector3(-hw, -hw, 0),
        ];
        const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x4488ff, depthTest: false, transparent: true, opacity: 1.0,
        });
        const line = new THREE.Line(lineGeom, lineMat);
        line.position.set(cx, cy, 5.8);
        line.renderOrder = 9999;
        line.frustumCulled = false;
        line.userData.editorGrid = true;
        rObj.scene.add(line);
        existing.push(line);
      }
    }

    // 2. 드래그 선택 영역
    if (editMode === 'event' && eventSelectionStart && eventSelectionEnd) {
      const minX = Math.min(eventSelectionStart.x, eventSelectionEnd.x);
      const maxX = Math.max(eventSelectionStart.x, eventSelectionEnd.x);
      const minY = Math.min(eventSelectionStart.y, eventSelectionEnd.y);
      const maxY = Math.max(eventSelectionStart.y, eventSelectionEnd.y);

      const rw = (maxX - minX + 1) * TILE_SIZE_PX;
      const rh = (maxY - minY + 1) * TILE_SIZE_PX;
      const cx = minX * TILE_SIZE_PX + rw / 2;
      const cy = minY * TILE_SIZE_PX + rh / 2;

      const geom = new THREE.PlaneGeometry(rw, rh);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00bfff, opacity: 0.15, transparent: true,
        depthTest: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(cx, cy, 6.5);
      mesh.renderOrder = 10004;
      mesh.frustumCulled = false;
      mesh.userData.editorGrid = true;
      rObj.scene.add(mesh);
      existing.push(mesh);

      const hw = rw / 2, hh = rh / 2;
      const pts = [
        new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
        new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
        new THREE.Vector3(-hw, -hh, 0),
      ];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0x00bfff, depthTest: false, transparent: true,
        opacity: 1.0, dashSize: 6, gapSize: 4,
      });
      const line = new THREE.Line(lineGeom, lineMat);
      line.computeLineDistances();
      line.position.set(cx, cy, 6.8);
      line.renderOrder = 10005;
      line.frustumCulled = false;
      line.userData.editorGrid = true;
      rObj.scene.add(line);
      existing.push(line);
    }

    // 3. 이벤트 붙여넣기 프리뷰
    if (editMode === 'event' && isEventPasting && eventPastePreviewPos) {
      const cb = clipboard;
      let evts: any[] | undefined;
      if (cb?.type === 'events' && cb.events) evts = cb.events as any[];
      else if (cb?.type === 'event' && cb.event) evts = [cb.event];
      if (evts && evts.length > 0) {
        const minX = Math.min(...evts.map((e: any) => e.x));
        const minY = Math.min(...evts.map((e: any) => e.y));
        for (const evt of evts) {
          const nx = eventPastePreviewPos.x + ((evt as any).x - minX);
          const ny = eventPastePreviewPos.y + ((evt as any).y - minY);
          const cx = nx * TILE_SIZE_PX + TILE_SIZE_PX / 2;
          const cy = ny * TILE_SIZE_PX + TILE_SIZE_PX / 2;

          const geom = new THREE.PlaneGeometry(TILE_SIZE_PX, TILE_SIZE_PX);
          const mat = new THREE.MeshBasicMaterial({
            color: 0x00b450, opacity: 0.4, transparent: true,
            depthTest: false, side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.position.set(cx, cy, 6);
          mesh.renderOrder = 10000;
          mesh.frustumCulled = false;
          mesh.userData.editorGrid = true;
          rObj.scene.add(mesh);
          existing.push(mesh);

          const hw = TILE_SIZE_PX / 2;
          const pts = [
            new THREE.Vector3(-hw, -hw, 0), new THREE.Vector3(hw, -hw, 0),
            new THREE.Vector3(hw, hw, 0), new THREE.Vector3(-hw, hw, 0),
            new THREE.Vector3(-hw, -hw, 0),
          ];
          const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
          const lineMat = new THREE.LineBasicMaterial({
            color: 0x00ff00, depthTest: false, transparent: true, opacity: 1.0,
          });
          const line = new THREE.Line(lineGeom, lineMat);
          line.position.set(cx, cy, 6.5);
          line.renderOrder = 10001;
          line.frustumCulled = false;
          line.userData.editorGrid = true;
          rObj.scene.add(line);
          existing.push(line);
        }
      }
    }

    // Trigger render
    if (!renderRequestedRef.current) {
      renderRequestedRef.current = true;
      requestAnimationFrame(() => {
        renderRequestedRef.current = false;
        if (!rendererObjRef.current || !stageRef.current) return;
        const strategy = (window as any).RendererStrategy?.getStrategy();
        if (strategy) strategy.render(rendererObjRef.current, stageRef.current);
      });
    }
  }, [editMode, selectedEventIds, eventSelectionStart, eventSelectionEnd, isEventPasting, eventPastePreviewPos, clipboard, currentMap?.events, rendererReady]);

  // =========================================================================
  // Light selection overlays (선택된 라이트 하이라이트 + 드래그 선택 영역)
  // =========================================================================
  React.useEffect(() => {
    const rObj = rendererObjRef.current;
    if (!rObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    if (!(window as any)._editorLightSelMeshes) (window as any)._editorLightSelMeshes = [];
    const existing = (window as any)._editorLightSelMeshes as any[];
    for (const m of existing) {
      rObj.scene.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
    existing.length = 0;

    // 1. 선택된 라이트 하이라이트
    if (lightEditMode && selectedLightIds.length > 0 && currentMap?.editorLights?.points) {
      for (const lid of selectedLightIds) {
        const light = currentMap.editorLights.points.find(p => p.id === lid);
        if (!light) continue;
        const cx = light.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const cy = light.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;

        const geom = new THREE.PlaneGeometry(TILE_SIZE_PX, TILE_SIZE_PX);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xffcc44, opacity: 0.3, transparent: true,
          depthTest: false, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(cx, cy, 5.5);
        mesh.renderOrder = 9998;
        mesh.frustumCulled = false;
        mesh.userData.editorGrid = true;
        rObj.scene.add(mesh);
        existing.push(mesh);

        const hw = TILE_SIZE_PX / 2;
        const pts = [
          new THREE.Vector3(-hw, -hw, 0), new THREE.Vector3(hw, -hw, 0),
          new THREE.Vector3(hw, hw, 0), new THREE.Vector3(-hw, hw, 0),
          new THREE.Vector3(-hw, -hw, 0),
        ];
        const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0xffcc44, depthTest: false, transparent: true, opacity: 1.0,
        });
        const line = new THREE.Line(lineGeom, lineMat);
        line.position.set(cx, cy, 5.8);
        line.renderOrder = 9999;
        line.frustumCulled = false;
        line.userData.editorGrid = true;
        rObj.scene.add(line);
        existing.push(line);
      }
    }

    // 2. 드래그 선택 영역
    if (lightEditMode && lightSelectionStart && lightSelectionEnd) {
      const minX = Math.min(lightSelectionStart.x, lightSelectionEnd.x);
      const maxX = Math.max(lightSelectionStart.x, lightSelectionEnd.x);
      const minY = Math.min(lightSelectionStart.y, lightSelectionEnd.y);
      const maxY = Math.max(lightSelectionStart.y, lightSelectionEnd.y);

      const rw = (maxX - minX + 1) * TILE_SIZE_PX;
      const rh = (maxY - minY + 1) * TILE_SIZE_PX;
      const cx = minX * TILE_SIZE_PX + rw / 2;
      const cy = minY * TILE_SIZE_PX + rh / 2;

      const geom = new THREE.PlaneGeometry(rw, rh);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffaa00, opacity: 0.15, transparent: true,
        depthTest: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(cx, cy, 6.5);
      mesh.renderOrder = 10004;
      mesh.frustumCulled = false;
      mesh.userData.editorGrid = true;
      rObj.scene.add(mesh);
      existing.push(mesh);

      const hw = rw / 2, hh = rh / 2;
      const pts = [
        new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
        new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
        new THREE.Vector3(-hw, -hh, 0),
      ];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0xffaa00, depthTest: false, transparent: true,
        opacity: 1.0, dashSize: 6, gapSize: 4,
      });
      const line = new THREE.Line(lineGeom, lineMat);
      line.computeLineDistances();
      line.position.set(cx, cy, 6.8);
      line.renderOrder = 10005;
      line.frustumCulled = false;
      line.userData.editorGrid = true;
      rObj.scene.add(line);
      existing.push(line);
    }

    // 3. 라이트 붙여넣기 프리뷰
    if (lightEditMode && isLightPasting && lightPastePreviewPos && clipboard?.type === 'lights' && clipboard.lights) {
      const srcLights = clipboard.lights as any[];
      if (srcLights.length > 0) {
        const minX = Math.min(...srcLights.map((l: any) => l.x));
        const minY = Math.min(...srcLights.map((l: any) => l.y));
        for (const light of srcLights) {
          const nx = lightPastePreviewPos.x + (light.x - minX);
          const ny = lightPastePreviewPos.y + (light.y - minY);
          const cx = nx * TILE_SIZE_PX + TILE_SIZE_PX / 2;
          const cy = ny * TILE_SIZE_PX + TILE_SIZE_PX / 2;

          const geom = new THREE.PlaneGeometry(TILE_SIZE_PX, TILE_SIZE_PX);
          const mat = new THREE.MeshBasicMaterial({
            color: 0xffcc88, opacity: 0.4, transparent: true,
            depthTest: false, side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.position.set(cx, cy, 6);
          mesh.renderOrder = 10000;
          mesh.frustumCulled = false;
          mesh.userData.editorGrid = true;
          rObj.scene.add(mesh);
          existing.push(mesh);

          const hw = TILE_SIZE_PX / 2;
          const pts = [
            new THREE.Vector3(-hw, -hw, 0), new THREE.Vector3(hw, -hw, 0),
            new THREE.Vector3(hw, hw, 0), new THREE.Vector3(-hw, hw, 0),
            new THREE.Vector3(-hw, -hw, 0),
          ];
          const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
          const lineMat = new THREE.LineBasicMaterial({
            color: 0xffcc88, depthTest: false, transparent: true, opacity: 1.0,
          });
          const line = new THREE.Line(lineGeom, lineMat);
          line.position.set(cx, cy, 6.5);
          line.renderOrder = 10001;
          line.frustumCulled = false;
          line.userData.editorGrid = true;
          rObj.scene.add(line);
          existing.push(line);
        }
      }
    }

    // Trigger render
    if (!renderRequestedRef.current) {
      renderRequestedRef.current = true;
      requestAnimationFrame(() => {
        renderRequestedRef.current = false;
        if (!rendererObjRef.current || !stageRef.current) return;
        const strategy = (window as any).RendererStrategy?.getStrategy();
        if (strategy) strategy.render(rendererObjRef.current, stageRef.current);
      });
    }
  }, [lightEditMode, selectedLightIds, lightSelectionStart, lightSelectionEnd, isLightPasting, lightPastePreviewPos, clipboard, currentMap?.editorLights?.points, rendererReady]);

  // =========================================================================
  // Object selection overlays (선택된 오브젝트 하이라이트 + 드래그 선택 영역)
  // =========================================================================
  React.useEffect(() => {
    const rObj = rendererObjRef.current;
    if (!rObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    if (!(window as any)._editorObjSelMeshes) (window as any)._editorObjSelMeshes = [];
    const existing = (window as any)._editorObjSelMeshes as any[];
    for (const m of existing) {
      rObj.scene.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
    existing.length = 0;

    const isObjMode = editMode === 'object';

    // 1. 선택된 오브젝트 하이라이트
    if (isObjMode && selectedObjectIds.length > 0 && currentMap?.objects) {
      for (const oid of selectedObjectIds) {
        const obj = (currentMap.objects as any[]).find(o => o.id === oid);
        if (!obj) continue;
        const ow = obj.width || 1;
        const oh = obj.height || 1;
        const rw = ow * TILE_SIZE_PX;
        const rh = oh * TILE_SIZE_PX;
        const cx = obj.x * TILE_SIZE_PX + rw / 2;
        const cy = (obj.y - oh + 1) * TILE_SIZE_PX + rh / 2;

        const geom = new THREE.PlaneGeometry(rw, rh);
        const mat = new THREE.MeshBasicMaterial({
          color: 0x44ff88, opacity: 0.3, transparent: true,
          depthTest: false, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(cx, cy, 5.5);
        mesh.renderOrder = 9998;
        mesh.frustumCulled = false;
        mesh.userData.editorGrid = true;
        rObj.scene.add(mesh);
        existing.push(mesh);

        const hw = rw / 2, hh = rh / 2;
        const pts = [
          new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
          new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
          new THREE.Vector3(-hw, -hh, 0),
        ];
        const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x44ff88, depthTest: false, transparent: true, opacity: 1.0,
        });
        const line = new THREE.Line(lineGeom, lineMat);
        line.position.set(cx, cy, 5.8);
        line.renderOrder = 9999;
        line.frustumCulled = false;
        line.userData.editorGrid = true;
        rObj.scene.add(line);
        existing.push(line);
      }
    }

    // 2. 드래그 선택 영역
    if (isObjMode && objectSelectionStart && objectSelectionEnd) {
      const minX = Math.min(objectSelectionStart.x, objectSelectionEnd.x);
      const maxX = Math.max(objectSelectionStart.x, objectSelectionEnd.x);
      const minY = Math.min(objectSelectionStart.y, objectSelectionEnd.y);
      const maxY = Math.max(objectSelectionStart.y, objectSelectionEnd.y);

      const rw = (maxX - minX + 1) * TILE_SIZE_PX;
      const rh = (maxY - minY + 1) * TILE_SIZE_PX;
      const cx = minX * TILE_SIZE_PX + rw / 2;
      const cy = minY * TILE_SIZE_PX + rh / 2;

      const geom = new THREE.PlaneGeometry(rw, rh);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00ff66, opacity: 0.15, transparent: true,
        depthTest: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(cx, cy, 6.5);
      mesh.renderOrder = 10004;
      mesh.frustumCulled = false;
      mesh.userData.editorGrid = true;
      rObj.scene.add(mesh);
      existing.push(mesh);

      const hw = rw / 2, hh = rh / 2;
      const pts = [
        new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
        new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
        new THREE.Vector3(-hw, -hh, 0),
      ];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0x00ff66, depthTest: false, transparent: true,
        opacity: 1.0, dashSize: 6, gapSize: 4,
      });
      const line = new THREE.Line(lineGeom, lineMat);
      line.computeLineDistances();
      line.position.set(cx, cy, 6.8);
      line.renderOrder = 10005;
      line.frustumCulled = false;
      line.userData.editorGrid = true;
      rObj.scene.add(line);
      existing.push(line);
    }

    // 3. 오브젝트 붙여넣기 프리뷰
    if (isObjMode && isObjectPasting && objectPastePreviewPos && clipboard?.type === 'objects' && clipboard.objects) {
      const srcObjs = clipboard.objects as any[];
      if (srcObjs.length > 0) {
        const minX = Math.min(...srcObjs.map((o: any) => o.x));
        const minY = Math.min(...srcObjs.map((o: any) => o.y));
        for (const obj of srcObjs) {
          const nx = objectPastePreviewPos.x + (obj.x - minX);
          const ny = objectPastePreviewPos.y + (obj.y - minY);
          const ow = obj.width || 1;
          const oh = obj.height || 1;
          const rw = ow * TILE_SIZE_PX;
          const rh = oh * TILE_SIZE_PX;
          const cx = nx * TILE_SIZE_PX + rw / 2;
          const cy = (ny - oh + 1) * TILE_SIZE_PX + rh / 2;

          const geom = new THREE.PlaneGeometry(rw, rh);
          const mat = new THREE.MeshBasicMaterial({
            color: 0x00ff66, opacity: 0.4, transparent: true,
            depthTest: false, side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.position.set(cx, cy, 6);
          mesh.renderOrder = 10000;
          mesh.frustumCulled = false;
          mesh.userData.editorGrid = true;
          rObj.scene.add(mesh);
          existing.push(mesh);

          const hw = rw / 2, hh = rh / 2;
          const pts = [
            new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
            new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
            new THREE.Vector3(-hw, -hh, 0),
          ];
          const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
          const lineMat = new THREE.LineBasicMaterial({
            color: 0x00ff66, depthTest: false, transparent: true, opacity: 1.0,
          });
          const line = new THREE.Line(lineGeom, lineMat);
          line.position.set(cx, cy, 6.5);
          line.renderOrder = 10001;
          line.frustumCulled = false;
          line.userData.editorGrid = true;
          rObj.scene.add(line);
          existing.push(line);
        }
      }
    }

    // Trigger render
    if (!renderRequestedRef.current) {
      renderRequestedRef.current = true;
      requestAnimationFrame(() => {
        renderRequestedRef.current = false;
        if (!rendererObjRef.current || !stageRef.current) return;
        const strategy = (window as any).RendererStrategy?.getStrategy();
        if (strategy) strategy.render(rendererObjRef.current, stageRef.current);
      });
    }
  }, [editMode, selectedObjectIds, objectSelectionStart, objectSelectionEnd, isObjectPasting, objectPastePreviewPos, clipboard, currentMap?.objects, rendererReady]);

  // =========================================================================
  // Paste preview overlay (붙여넣기 프리뷰)
  // =========================================================================
  const pastePreviewMeshRef = useRef<any>(null);
  const pastePreviewLineRef = useRef<any>(null);
  const pastePreviewTextureRef = useRef<any>(null);

  // 붙여넣기 프리뷰 텍스처 생성 (clipboard 변경 시)
  React.useEffect(() => {
    if (pastePreviewTextureRef.current) {
      pastePreviewTextureRef.current.dispose();
      pastePreviewTextureRef.current = null;
    }

    const THREE = (window as any).THREE;
    const tilemap = tilemapRef.current;
    const TilemapClass = (window as any).Tilemap;
    if (!THREE || !tilemap || !TilemapClass) return;
    if (!clipboard || clipboard.type !== 'tiles' || !clipboard.tiles || !clipboard.width || !clipboard.height) return;

    const tw = TILE_SIZE_PX;
    const th = TILE_SIZE_PX;
    const cvs = document.createElement('canvas');
    cvs.width = tw * clipboard.width;
    cvs.height = th * clipboard.height;
    const ctx = cvs.getContext('2d')!;

    const offBitmap = {
      _canvas: cvs, _context: ctx, width: cvs.width, height: cvs.height,
      bltImage(source: any, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) {
        const srcCanvas = source._canvas || source._image;
        if (srcCanvas) ctx.drawImage(srcCanvas, sx, sy, sw, sh, dx, dy, dw, dh);
      },
      blt(source: any, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw?: number, dh?: number) {
        this.bltImage(source, sx, sy, sw, sh, dx, dy, dw ?? sw, dh ?? sh);
      },
    };

    const proxy = Object.create(TilemapClass.prototype);
    proxy.bitmaps = tilemap.bitmaps;
    proxy._tileWidth = tilemap._tileWidth;
    proxy._tileHeight = tilemap._tileHeight;
    proxy.flags = tilemap.flags;

    for (const t of clipboard.tiles) {
      if (t.tileId <= 0) continue;
      proxy._drawTile(offBitmap, t.tileId, t.x * tw, t.y * th);
    }

    const texture = new THREE.CanvasTexture(cvs);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.flipY = false;
    pastePreviewTextureRef.current = texture;
  }, [clipboard, rendererReady]);

  // 붙여넣기 프리뷰 메시 표시/숨김 및 위치 업데이트
  React.useEffect(() => {
    const rObj = rendererObjRef.current;
    if (!rObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    const texture = pastePreviewTextureRef.current;
    const showPreview = isPasting && pastePreviewPos && texture &&
      clipboard?.type === 'tiles' && clipboard.width && clipboard.height;

    if (!showPreview) {
      if (pastePreviewMeshRef.current) {
        pastePreviewMeshRef.current.visible = false;
        pastePreviewLineRef.current.visible = false;
        if (!renderRequestedRef.current) {
          renderRequestedRef.current = true;
          requestAnimationFrame(() => {
            renderRequestedRef.current = false;
            if (!rendererObjRef.current || !stageRef.current) return;
            const strategy = (window as any).RendererStrategy?.getStrategy();
            if (strategy) strategy.render(rendererObjRef.current, stageRef.current);
          });
        }
      }
      return;
    }

    const tw = TILE_SIZE_PX;
    const th = TILE_SIZE_PX;
    const tilesW = clipboard!.width!;
    const tilesH = clipboard!.height!;

    // 메시가 없거나 텍스처가 바뀌었으면 재생성
    if (!pastePreviewMeshRef.current || pastePreviewMeshRef.current.material.map !== texture) {
      if (pastePreviewMeshRef.current) {
        rObj.scene.remove(pastePreviewMeshRef.current);
        pastePreviewMeshRef.current.geometry?.dispose();
        pastePreviewMeshRef.current.material?.dispose();
      }
      if (pastePreviewLineRef.current) {
        rObj.scene.remove(pastePreviewLineRef.current);
        pastePreviewLineRef.current.geometry?.dispose();
        pastePreviewLineRef.current.material?.dispose();
      }

      const geom = new THREE.PlaneGeometry(tw * tilesW, th * tilesH);
      const mat = new THREE.MeshBasicMaterial({
        map: texture, transparent: true, opacity: 0.5,
        depthTest: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.renderOrder = 10012;
      mesh.frustumCulled = false;
      mesh.userData.editorGrid = true;
      rObj.scene.add(mesh);
      pastePreviewMeshRef.current = mesh;

      const hw = tw * tilesW / 2;
      const hh = th * tilesH / 2;
      const pts = [
        new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
        new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
        new THREE.Vector3(-hw, -hh, 0),
      ];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0x00bfff, depthTest: false, transparent: true,
        opacity: 1.0, dashSize: 6, gapSize: 4,
      });
      const line = new THREE.Line(lineGeom, lineMat);
      line.computeLineDistances();
      line.renderOrder = 10013;
      line.frustumCulled = false;
      line.userData.editorGrid = true;
      rObj.scene.add(line);
      pastePreviewLineRef.current = line;
    }

    // 위치 업데이트
    const cx = pastePreviewPos!.x * tw + tw * tilesW / 2;
    const cy = pastePreviewPos!.y * th + th * tilesH / 2;
    pastePreviewMeshRef.current.position.set(cx, cy, 8);
    pastePreviewMeshRef.current.visible = true;
    pastePreviewLineRef.current.position.set(cx, cy, 8.5);
    pastePreviewLineRef.current.visible = true;

    if (!renderRequestedRef.current) {
      renderRequestedRef.current = true;
      requestAnimationFrame(() => {
        renderRequestedRef.current = false;
        if (!rendererObjRef.current || !stageRef.current) return;
        const strategy = (window as any).RendererStrategy?.getStrategy();
        if (strategy) strategy.render(rendererObjRef.current, stageRef.current);
      });
    }
  }, [isPasting, pastePreviewPos, clipboard, rendererReady]);

  // =========================================================================
  // Tile cursor preview (반투명 타일 프리뷰)
  // =========================================================================
  const tilePreviewMeshRef = useRef<any>(null);  // 타일 이미지 메시
  const tilePreviewLineRef = useRef<any>(null);  // 테두리 라인
  const tilePreviewTextureRef = useRef<any>(null); // 텍스처 (재사용)

  // 텍스처 생성 (타일 선택이 변경될 때만)
  React.useEffect(() => {
    // 기존 텍스처 해제
    if (tilePreviewTextureRef.current) {
      tilePreviewTextureRef.current.dispose();
      tilePreviewTextureRef.current = null;
    }

    const THREE = (window as any).THREE;
    const tilemap = tilemapRef.current;
    const TilemapClass = (window as any).Tilemap;
    if (!THREE || !tilemap || !TilemapClass || selectedTileId <= 0) return;
    if (editMode !== 'map' && editMode !== 'object') return;
    if (selectedTool !== 'pen') return;

    const tw = TILE_SIZE_PX;
    const th = TILE_SIZE_PX;
    const isMulti = selectedTiles && (selectedTilesWidth > 1 || selectedTilesHeight > 1);
    const tilesW = isMulti ? selectedTilesWidth : 1;
    const tilesH = isMulti ? selectedTilesHeight : 1;

    const cvs = document.createElement('canvas');
    cvs.width = tw * tilesW;
    cvs.height = th * tilesH;
    const ctx = cvs.getContext('2d')!;

    const offBitmap = {
      _canvas: cvs, _context: ctx, width: cvs.width, height: cvs.height,
      bltImage(source: any, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) {
        const srcCanvas = source._canvas || source._image;
        if (srcCanvas) ctx.drawImage(srcCanvas, sx, sy, sw, sh, dx, dy, dw, dh);
      },
      blt(source: any, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw?: number, dh?: number) {
        this.bltImage(source, sx, sy, sw, sh, dx, dy, dw ?? sw, dh ?? sh);
      },
    };

    const proxy = Object.create(TilemapClass.prototype);
    proxy.bitmaps = tilemap.bitmaps;
    proxy._tileWidth = tilemap._tileWidth;
    proxy._tileHeight = tilemap._tileHeight;
    proxy.flags = tilemap.flags;

    for (let row = 0; row < tilesH; row++) {
      for (let col = 0; col < tilesW; col++) {
        const tileId = isMulti ? selectedTiles![row][col] : selectedTileId;
        if (tileId <= 0) continue;
        proxy._drawTile(offBitmap, tileId, col * tw, row * th);
      }
    }

    const texture = new THREE.CanvasTexture(cvs);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.flipY = false;
    tilePreviewTextureRef.current = texture;
  }, [editMode, selectedTool, selectedTileId, selectedTiles, selectedTilesWidth, selectedTilesHeight, rendererReady]);

  // 메시 표시/숨김 및 위치 업데이트 (hoverTile이 변경될 때)
  React.useEffect(() => {
    const rObj = rendererObjRef.current;
    if (!rObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    const texture = tilePreviewTextureRef.current;
    const showPreview = hoverTile && texture &&
      (editMode === 'map' || editMode === 'object') &&
      selectedTool === 'pen' && selectedTileId > 0;

    if (!showPreview) {
      // 숨기기
      if (tilePreviewMeshRef.current) {
        tilePreviewMeshRef.current.visible = false;
        tilePreviewLineRef.current.visible = false;
        if (!renderRequestedRef.current) {
          renderRequestedRef.current = true;
          requestAnimationFrame(() => {
            renderRequestedRef.current = false;
            if (!rendererObjRef.current || !stageRef.current) return;
            const strategy = (window as any).RendererStrategy?.getStrategy();
            if (strategy) strategy.render(rendererObjRef.current, stageRef.current);
          });
        }
      }
      return;
    }

    const tw = TILE_SIZE_PX;
    const th = TILE_SIZE_PX;
    const isMulti = selectedTiles && (selectedTilesWidth > 1 || selectedTilesHeight > 1);
    const tilesW = isMulti ? selectedTilesWidth : 1;
    const tilesH = isMulti ? selectedTilesHeight : 1;

    // 메시가 없거나 텍스처가 바뀌었으면 재생성
    if (!tilePreviewMeshRef.current || tilePreviewMeshRef.current.material.map !== texture) {
      // 기존 제거
      if (tilePreviewMeshRef.current) {
        rObj.scene.remove(tilePreviewMeshRef.current);
        tilePreviewMeshRef.current.geometry?.dispose();
        tilePreviewMeshRef.current.material?.dispose();
      }
      if (tilePreviewLineRef.current) {
        rObj.scene.remove(tilePreviewLineRef.current);
        tilePreviewLineRef.current.geometry?.dispose();
        tilePreviewLineRef.current.material?.dispose();
      }

      const geom = new THREE.PlaneGeometry(tw * tilesW, th * tilesH);
      const mat = new THREE.MeshBasicMaterial({
        map: texture, transparent: true, opacity: 0.6,
        depthTest: false, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.renderOrder = 10010;
      mesh.frustumCulled = false;
      mesh.userData.editorGrid = true;
      rObj.scene.add(mesh);
      tilePreviewMeshRef.current = mesh;

      const hw = tw * tilesW / 2;
      const hh = th * tilesH / 2;
      const pts = [
        new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0),
        new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
        new THREE.Vector3(-hw, -hh, 0),
      ];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xffffff, depthTest: false, transparent: true, opacity: 0.8,
      });
      const line = new THREE.Line(lineGeom, lineMat);
      line.renderOrder = 10011;
      line.frustumCulled = false;
      line.userData.editorGrid = true;
      rObj.scene.add(line);
      tilePreviewLineRef.current = line;
    }

    // 위치 업데이트
    const baseX = hoverTile!.x;
    const baseY = hoverTile!.y;
    let cx: number, cy: number;
    if (editMode === 'object') {
      cx = baseX * tw + tw * tilesW / 2;
      cy = (baseY - tilesH + 1) * th + th * tilesH / 2;
    } else {
      cx = baseX * tw + tw * tilesW / 2;
      cy = baseY * th + th * tilesH / 2;
    }

    tilePreviewMeshRef.current.position.set(cx, cy, 8);
    tilePreviewMeshRef.current.visible = true;
    tilePreviewLineRef.current.position.set(cx, cy, 8.5);
    tilePreviewLineRef.current.visible = true;

    // Trigger render
    if (!renderRequestedRef.current) {
      renderRequestedRef.current = true;
      requestAnimationFrame(() => {
        renderRequestedRef.current = false;
        if (!rendererObjRef.current || !stageRef.current) return;
        const strategy = (window as any).RendererStrategy?.getStrategy();
        if (strategy) strategy.render(rendererObjRef.current, stageRef.current);
      });
    }
  }, [hoverTile, editMode, selectedTool, selectedTileId, selectedTiles, selectedTilesWidth, selectedTilesHeight, rendererReady]);

  // =========================================================================
  // Render
  // =========================================================================
  const parallaxName = currentMap?.parallaxName || '';
  const parallaxShow = currentMap?.parallaxShow ?? false;
  const mapPxW = (currentMap?.width || 0) * TILE_SIZE_PX;
  const mapPxH = (currentMap?.height || 0) * TILE_SIZE_PX;

  // 카메라 존 모드일 때, 맵 밖으로 확장된 존을 위해 inner wrapper 최소 크기 계산
  const extendedSize = useMemo(() => {
    if (editMode !== 'cameraZone') return { width: mapPxW, height: mapPxH };
    let maxRight = mapPxW;
    let maxBottom = mapPxH;
    const zones = currentMap?.cameraZones;
    if (zones) {
      for (const z of zones) {
        const r = (z.x + z.width) * TILE_SIZE_PX;
        const b = (z.y + z.height) * TILE_SIZE_PX;
        if (r > maxRight) maxRight = r;
        if (b > maxBottom) maxBottom = b;
      }
    }
    if (cameraZoneDragPreview) {
      const r = (cameraZoneDragPreview.x + cameraZoneDragPreview.width) * TILE_SIZE_PX;
      const b = (cameraZoneDragPreview.y + cameraZoneDragPreview.height) * TILE_SIZE_PX;
      if (r > maxRight) maxRight = r;
      if (b > maxBottom) maxBottom = b;
    }
    return { width: maxRight, height: maxBottom };
  }, [editMode, currentMap?.cameraZones, cameraZoneDragPreview, mapPxW, mapPxH]);

  const eyedropperCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M20.71 5.63l-2.34-2.34a1 1 0 00-1.41 0l-3.54 3.54 1.41 1.41L16.25 6.8l.88.88-5.66 5.66-1.41-1.41-2.12 2.12a3 3 0 000 4.24l.71.71a3 3 0 004.24 0l2.12-2.12-1.41-1.41 5.66-5.66.88.88 1.41-1.41-3.54-3.54a1 1 0 000-1.41z' fill='white' stroke='black' stroke-width='0.5'/%3E%3C/svg%3E") 2 22, crosshair`;

  const transparentColor = useEditorStore((s) => s.transparentColor);
  const containerStyle = useMemo(() => ({
    flex: 1 as const,
    overflow: 'auto' as const,
    backgroundColor: '#1a1a1a',
    border: '1px solid #555',
    cursor: panning ? 'grabbing' : undefined,
  }), [panning]);

  const mapBgStyle = useMemo(() => {
    const { r, g, b } = transparentColor;
    const c1 = `rgb(${r}, ${g}, ${b})`;
    const dr = Math.max(0, r - 48), dg = Math.max(0, g - 48), db = Math.max(0, b - 48);
    const c2 = `rgb(${dr}, ${dg}, ${db})`;
    return {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: mapPxW,
      height: mapPxH,
      backgroundColor: c1,
      backgroundImage: `
        linear-gradient(45deg, ${c2} 25%, transparent 25%),
        linear-gradient(-45deg, ${c2} 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, ${c2} 75%),
        linear-gradient(-45deg, transparent 75%, ${c2} 75%)
      `,
      backgroundSize: '16px 16px',
      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
      zIndex: 0,
    };
  }, [transparentColor, mapPxW, mapPxH]);

  return (
    <div ref={containerRef} style={containerStyle} onClick={closeEventCtxMenu}>
      <div style={{
        position: 'relative',
        transform: `scale(${zoomLevel})`,
        transformOrigin: '0 0',
        minWidth: extendedSize.width,
        minHeight: extendedSize.height,
      }}>
        {/* Map interior checkerboard background */}
        <div style={mapBgStyle} />
        {parallaxName && parallaxShow && (
          <div
            ref={parallaxDivRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: mapPxW,
              height: mapPxH,
              backgroundImage: `url(/api/resources/parallaxes/${parallaxName}.png)`,
              backgroundRepeat: 'repeat',
              backgroundSize: 'auto',
              zIndex: 0,
            }}
          />
        )}
        <canvas
          ref={webglCanvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          style={{
            ...styles.canvas,
            position: 'relative',
            zIndex: 1,
            cursor: panning ? 'grabbing'
              : altPressed && editMode === 'map' ? eyedropperCursor
              : cameraZoneCursor
              || resizeCursor
              || (selectedTool === 'select' && isPasting ? 'copy'
                : selectedTool === 'select' && selectionStart && selectionEnd && hoverTile
                  && hoverTile.x >= Math.min(selectionStart.x, selectionEnd.x)
                  && hoverTile.x <= Math.max(selectionStart.x, selectionEnd.x)
                  && hoverTile.y >= Math.min(selectionStart.y, selectionEnd.y)
                  && hoverTile.y <= Math.max(selectionStart.y, selectionEnd.y) ? 'move'
                : selectedTool === 'select' ? 'crosshair'
                : editMode === 'event' ? 'pointer'
                : 'crosshair'),
          }}
        />
        {/* Camera Zone HTML overlays (맵 경계 밖까지 렌더링 가능) */}
        {editMode === 'cameraZone' && currentMap?.cameraZones && currentMap.cameraZones.map((zone) => {
          const zx = zone.x * TILE_SIZE_PX;
          const zy = zone.y * TILE_SIZE_PX;
          const zw = zone.width * TILE_SIZE_PX;
          const zh = zone.height * TILE_SIZE_PX;
          const isSelected = zone.id === selectedCameraZoneId;
          return (
            <React.Fragment key={zone.id}>
              {/* Fill */}
              <div style={{
                position: 'absolute', left: zx, top: zy, width: zw, height: zh,
                background: isSelected ? 'rgba(255,136,0,0.25)' : 'rgba(34,136,255,0.15)',
                border: `2px dashed ${isSelected ? '#ffaa44' : '#44aaff'}`,
                boxSizing: 'border-box',
                pointerEvents: 'none',
                zIndex: 2,
              }} />
              {/* Name label */}
              {zone.name && (
                <div style={{
                  position: 'absolute',
                  left: zx + 4,
                  top: zy + 4,
                  background: 'rgba(0,0,0,0.6)',
                  color: isSelected ? '#ffaa44' : '#88ccff',
                  fontSize: 14,
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  pointerEvents: 'none',
                  zIndex: 2,
                  whiteSpace: 'nowrap',
                }}>
                  {zone.name}
                </div>
              )}
            </React.Fragment>
          );
        })}
        {/* Camera Zone drag/creation preview */}
        {editMode === 'cameraZone' && cameraZoneDragPreview && (
          <div style={{
            position: 'absolute',
            left: cameraZoneDragPreview.x * TILE_SIZE_PX,
            top: cameraZoneDragPreview.y * TILE_SIZE_PX,
            width: cameraZoneDragPreview.width * TILE_SIZE_PX,
            height: cameraZoneDragPreview.height * TILE_SIZE_PX,
            background: 'rgba(68,255,136,0.2)',
            border: '2px dashed #44ff88',
            boxSizing: 'border-box',
            pointerEvents: 'none',
            zIndex: 2,
          }} />
        )}
        {/* Resize preview overlay */}
        {resizePreview && currentMap && (() => {
          const { dLeft, dTop, dRight, dBottom } = resizePreview;
          const origW = resizeOrigSize.current.w;
          const origH = resizeOrigSize.current.h;
          const newW = origW + dRight - dLeft;
          const newH = origH + dBottom - dTop;
          const previewLeft = dLeft * TILE_SIZE_PX;
          const previewTop = dTop * TILE_SIZE_PX;
          const previewW = newW * TILE_SIZE_PX;
          const previewH = newH * TILE_SIZE_PX;
          return (
            <>
              <div style={{
                position: 'absolute',
                left: previewLeft,
                top: previewTop,
                width: previewW,
                height: previewH,
                border: '2px dashed #4af',
                pointerEvents: 'none',
                zIndex: 3,
                boxSizing: 'border-box',
              }} />
              <div style={{
                position: 'absolute',
                left: previewLeft + previewW / 2,
                top: previewTop - 20,
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.7)',
                color: '#4af',
                padding: '2px 8px',
                borderRadius: 3,
                fontSize: 12,
                fontWeight: 'bold',
                pointerEvents: 'none',
                zIndex: 4,
                whiteSpace: 'nowrap',
              }}>
                {origW}x{origH} → {newW}x{newH}
              </div>
            </>
          );
        })()}
      </div>

      {eventCtxMenu && (
        <div className="context-menu" style={{ left: eventCtxMenu.x, top: eventCtxMenu.y }} onClick={e => e.stopPropagation()}>
          {eventCtxMenu.eventId == null && (
            <div className="context-menu-item" onClick={() => { createNewEvent(eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>새 이벤트...</div>
          )}
          {eventCtxMenu.eventId != null && selectedEventIds.length > 1 && selectedEventIds.includes(eventCtxMenu.eventId) && (
            <>
              <div className="context-menu-item" onClick={() => { copyEvents(selectedEventIds); closeEventCtxMenu(); }}>복사 ({selectedEventIds.length}개)</div>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={() => { deleteEvents(selectedEventIds); closeEventCtxMenu(); }}>삭제 ({selectedEventIds.length}개)</div>
            </>
          )}
          {eventCtxMenu.eventId != null && !(selectedEventIds.length > 1 && selectedEventIds.includes(eventCtxMenu.eventId)) && (
            <>
              <div className="context-menu-item" onClick={() => { setEditingEventId(eventCtxMenu.eventId!); closeEventCtxMenu(); }}>편집...</div>
              <div className="context-menu-item" onClick={() => { copyEvent(eventCtxMenu.eventId!); closeEventCtxMenu(); }}>복사</div>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={() => { deleteEvent(eventCtxMenu.eventId!); closeEventCtxMenu(); }}>삭제</div>
            </>
          )}
          {(clipboard?.type === 'event' || clipboard?.type === 'events') && (
            <>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={() => { pasteEvents(eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>붙여넣기</div>
            </>
          )}
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={() => { if (currentMapId) setPlayerStartPosition(currentMapId, eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>시작 위치 설정</div>
        </div>
      )}

      {editingEventId != null && (
        <EventDetail eventId={editingEventId} onClose={() => setEditingEventId(null)} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  canvas: {
    display: 'block',
    imageRendering: 'pixelated',
  },
};
