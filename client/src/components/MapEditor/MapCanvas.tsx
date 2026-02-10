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
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const setPlayerStartPosition = useEditorStore((s) => s.setPlayerStartPosition);
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
  } = useThreeRenderer(webglCanvasRef, containerRef, showGrid, []); // dragPreviews filled via useEffect

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
  }, [dragPreviews]);

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
  }, [editMode, selectedTool, selectedTileId, selectedTiles, selectedTilesWidth, selectedTilesHeight]);

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
  }, [hoverTile, editMode, selectedTool, selectedTileId, selectedTiles, selectedTilesWidth, selectedTilesHeight]);

  // =========================================================================
  // Render
  // =========================================================================
  const parallaxName = currentMap?.parallaxName || '';
  const parallaxShow = currentMap?.parallaxShow ?? false;
  const mapPxW = (currentMap?.width || 0) * TILE_SIZE_PX;
  const mapPxH = (currentMap?.height || 0) * TILE_SIZE_PX;

  const eyedropperCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M20.71 5.63l-2.34-2.34a1 1 0 00-1.41 0l-3.54 3.54 1.41 1.41L16.25 6.8l.88.88-5.66 5.66-1.41-1.41-2.12 2.12a3 3 0 000 4.24l.71.71a3 3 0 004.24 0l2.12-2.12-1.41-1.41 5.66-5.66.88.88 1.41-1.41-3.54-3.54a1 1 0 000-1.41z' fill='white' stroke='black' stroke-width='0.5'/%3E%3C/svg%3E") 2 22, crosshair`;

  return (
    <div ref={containerRef} style={{ ...styles.container, cursor: panning ? 'grabbing' : undefined }} onClick={closeEventCtxMenu}>
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
            cursor: panning ? 'grabbing' : altPressed && editMode === 'map' ? eyedropperCursor : resizeCursor || (editMode === 'event' ? 'pointer' : 'crosshair'),
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
  container: {
    flex: 1,
    overflow: 'auto',
    background: '#1a1a1a',
    border: '1px solid #555',
  },
  canvas: {
    display: 'block',
    imageRendering: 'pixelated',
  },
};
