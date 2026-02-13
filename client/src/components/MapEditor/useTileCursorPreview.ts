import React, { useRef } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';

interface OverlayRefs {
  rendererObjRef: React.MutableRefObject<any>;
  stageRef: React.MutableRefObject<any>;
  renderRequestedRef: React.MutableRefObject<boolean>;
  tilemapRef: React.MutableRefObject<any>;
}

function triggerRender(
  renderRequestedRef: React.MutableRefObject<boolean>,
  rendererObjRef: React.MutableRefObject<any>,
  stageRef: React.MutableRefObject<any>,
) {
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

/**
 * Tile cursor preview (반투명 타일 프리뷰)
 */
export function useTileCursorPreview(
  refs: OverlayRefs,
  hoverTile: { x: number; y: number } | null,
  rendererReady: number,
) {
  const editMode = useEditorStore((s) => s.editMode);
  const selectedTool = useEditorStore((s) => s.selectedTool);
  const selectedTileId = useEditorStore((s) => s.selectedTileId);
  const selectedTiles = useEditorStore((s) => s.selectedTiles);
  const selectedTilesWidth = useEditorStore((s) => s.selectedTilesWidth);
  const selectedTilesHeight = useEditorStore((s) => s.selectedTilesHeight);

  const tilePreviewMeshRef = useRef<any>(null);
  const tilePreviewLineRef = useRef<any>(null);
  const tilePreviewTextureRef = useRef<any>(null);

  // 텍스처 생성 (타일 선택이 변경될 때만)
  React.useEffect(() => {
    if (tilePreviewTextureRef.current) {
      tilePreviewTextureRef.current.dispose();
      tilePreviewTextureRef.current = null;
    }

    const THREE = (window as any).THREE;
    const tilemap = refs.tilemapRef.current;
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
    const rObj = refs.rendererObjRef.current;
    if (!rObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    const texture = tilePreviewTextureRef.current;
    const showPreview = hoverTile && texture &&
      (editMode === 'map' || editMode === 'object') &&
      selectedTool === 'pen' && selectedTileId > 0;

    if (!showPreview) {
      if (tilePreviewMeshRef.current) {
        tilePreviewMeshRef.current.visible = false;
        tilePreviewLineRef.current.visible = false;
        triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
      }
      return;
    }

    const tw = TILE_SIZE_PX;
    const th = TILE_SIZE_PX;
    const isMulti = selectedTiles && (selectedTilesWidth > 1 || selectedTilesHeight > 1);
    const tilesW = isMulti ? selectedTilesWidth : 1;
    const tilesH = isMulti ? selectedTilesHeight : 1;

    if (!tilePreviewMeshRef.current || tilePreviewMeshRef.current.material.map !== texture) {
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

    triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
  }, [hoverTile, editMode, selectedTool, selectedTileId, selectedTiles, selectedTilesWidth, selectedTilesHeight, rendererReady]);
}
