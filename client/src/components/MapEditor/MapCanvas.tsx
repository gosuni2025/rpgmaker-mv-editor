import React, { useRef, useMemo } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { TileChange } from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import EventDetail from '../EventEditor/EventDetail';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useThreeRenderer, type DragPreviewInfo } from './useThreeRenderer';
import { useMapTools } from './useMapTools';
import { useMouseHandlers } from './useMouseHandlers';

console.log('[MapCanvas] MODULE LOADED', Date.now());

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
  const setPlayerStartPosition = useEditorStore((s) => s.setPlayerStartPosition);
  const transparentColor = useEditorStore((s) => s.transparentColor);
  const copyEvent = useEditorStore((s) => s.copyEvent);
  const deleteEvent = useEditorStore((s) => s.deleteEvent);
  const pasteEvent = useEditorStore((s) => s.pasteEvent);

  // Compose hooks
  const { showGrid, altPressed, panning } = useKeyboardShortcuts(containerRef);

  // Mouse handlers first (to get drag previews for Three.js renderer)
  // We need a forward declaration pattern: tools needs renderer refs, renderer needs drag previews
  // Solution: create renderer first with empty drag previews, then tools, then handlers
  // But handlers produce drag previews... we use useMemo to build dragPreviews from state

  const {
    rendererObjRef, tilemapRef, stageRef, renderRequestedRef, toolPreviewMeshesRef,
    rendererReady,
  } = useThreeRenderer(webglCanvasRef, showGrid, []); // dragPreviews filled via useEffect

  const tools = useMapTools(
    webglCanvasRef, pendingChanges, shadowPaintMode, shadowPainted,
    toolPreviewMeshesRef, rendererObjRef, stageRef, renderRequestedRef,
  );

  const {
    handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave,
    handleDoubleClick, handleContextMenu, createNewEvent,
    resizePreview, resizeCursor, dragPreview,
    lightDragPreview, objectDragPreview, hoverTile,
    eventCtxMenu, editingEventId, setEditingEventId,
    closeEventCtxMenu,
    isDraggingEvent, isDraggingLight, isDraggingObject, draggedObjectId,
    isResizing, resizeOrigSize,
  } = useMouseHandlers(webglCanvasRef, tools, pendingChanges);

  // Build drag previews for Three.js
  const dragPreviews = useMemo<DragPreviewInfo[]>(() => {
    const result: DragPreviewInfo[] = [];
    if (dragPreview && isDraggingEvent.current) {
      result.push({ type: 'event', x: dragPreview.x, y: dragPreview.y });
    }
    if (lightDragPreview && isDraggingLight.current) {
      result.push({ type: 'light', x: lightDragPreview.x, y: lightDragPreview.y });
    }
    if (objectDragPreview && isDraggingObject.current && draggedObjectId.current != null) {
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
  }, [dragPreview, lightDragPreview, objectDragPreview, currentMap?.objects]);

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

  const eyedropperCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M20.71 5.63l-2.34-2.34a1 1 0 00-1.41 0l-3.54 3.54 1.41 1.41L16.25 6.8l.88.88-5.66 5.66-1.41-1.41-2.12 2.12a3 3 0 000 4.24l.71.71a3 3 0 004.24 0l2.12-2.12-1.41-1.41 5.66-5.66.88.88 1.41-1.41-3.54-3.54a1 1 0 000-1.41z' fill='white' stroke='black' stroke-width='0.5'/%3E%3C/svg%3E") 2 22, crosshair`;

  const containerStyle = useMemo(() => {
    const { r, g, b } = transparentColor;
    const c1 = `rgb(${r}, ${g}, ${b})`;
    const dr = Math.max(0, r - 48), dg = Math.max(0, g - 48), db = Math.max(0, b - 48);
    const c2 = `rgb(${dr}, ${dg}, ${db})`;
    return {
      flex: 1 as const,
      overflow: 'auto' as const,
      backgroundColor: c1,
      backgroundImage: `
        linear-gradient(45deg, ${c2} 25%, transparent 25%),
        linear-gradient(-45deg, ${c2} 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, ${c2} 75%),
        linear-gradient(-45deg, transparent 75%, ${c2} 75%)
      `,
      backgroundSize: '16px 16px',
      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
      border: '1px solid #555',
      cursor: panning ? 'grabbing' : undefined,
    };
  }, [transparentColor, panning]);

  return (
    <div ref={containerRef} style={containerStyle} onClick={closeEventCtxMenu}>
      <div style={{
        position: 'relative',
        transform: `scale(${zoomLevel})`,
        transformOrigin: '0 0',
      }}>
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
              : resizeCursor
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
            <div className="context-menu-item" onClick={() => { createNewEvent(eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>New Event...</div>
          )}
          {eventCtxMenu.eventId != null && (
            <>
              <div className="context-menu-item" onClick={() => { setEditingEventId(eventCtxMenu.eventId!); closeEventCtxMenu(); }}>Edit...</div>
              <div className="context-menu-item" onClick={() => { copyEvent(eventCtxMenu.eventId!); closeEventCtxMenu(); }}>Copy</div>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={() => { deleteEvent(eventCtxMenu.eventId!); closeEventCtxMenu(); }}>Delete</div>
            </>
          )}
          {clipboard?.type === 'event' && (
            <>
              <div className="context-menu-separator" />
              <div className="context-menu-item" onClick={() => { pasteEvent(eventCtxMenu.tileX, eventCtxMenu.tileY); closeEventCtxMenu(); }}>Paste</div>
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
