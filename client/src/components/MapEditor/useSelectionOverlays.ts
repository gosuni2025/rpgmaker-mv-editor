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
 * Selection rectangle overlay (선택 영역 오버레이)
 */
export function useSelectionRectOverlay(refs: OverlayRefs, rendererReady: boolean) {
  const selectionStart = useEditorStore((s) => s.selectionStart);
  const selectionEnd = useEditorStore((s) => s.selectionEnd);

  React.useEffect(() => {
    const rObj = refs.rendererObjRef.current;
    if (!rObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    if (!(window as any)._editorSelectionMeshes) (window as any)._editorSelectionMeshes = [];
    const existing = (window as any)._editorSelectionMeshes as any[];
    for (const m of existing) {
      rObj.scene.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
    existing.length = 0;

    if (!selectionStart || !selectionEnd) {
      triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
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

    triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
  }, [selectionStart, selectionEnd, rendererReady]);
}

/**
 * Paste preview overlay (붙여넣기 프리뷰 텍스처 + 메시)
 */
export function usePastePreviewOverlay(refs: OverlayRefs, rendererReady: boolean) {
  const clipboard = useEditorStore((s) => s.clipboard);
  const isPasting = useEditorStore((s) => s.isPasting);
  const pastePreviewPos = useEditorStore((s) => s.pastePreviewPos);

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
    const tilemap = refs.tilemapRef.current;
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
    const rObj = refs.rendererObjRef.current;
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
        triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
      }
      return;
    }

    const tw = TILE_SIZE_PX;
    const th = TILE_SIZE_PX;
    const tilesW = clipboard!.width!;
    const tilesH = clipboard!.height!;

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

    const cx = pastePreviewPos!.x * tw + tw * tilesW / 2;
    const cy = pastePreviewPos!.y * th + th * tilesH / 2;
    pastePreviewMeshRef.current.position.set(cx, cy, 8);
    pastePreviewMeshRef.current.visible = true;
    pastePreviewLineRef.current.position.set(cx, cy, 8.5);
    pastePreviewLineRef.current.visible = true;

    triggerRender(refs.renderRequestedRef, refs.rendererObjRef, refs.stageRef);
  }, [isPasting, pastePreviewPos, clipboard, rendererReady]);
}
