import { useEffect } from 'react';
import useEditorStore from '../../../store/useEditorStore';
import { TILE_SIZE_PX, isTileA1, isTileA2, isTileA3, isTileA4, isTileA5, TILE_ID_A1 } from '../../../utils/tileHelper';
import { requestRenderFrames } from '../initGameGlobals';
import { createDashedRectBorder } from './overlayHelpers';
import type { OverlayRefs } from './types';

type DebugRefs = OverlayRefs & { tileIdDebugMeshesRef: React.MutableRefObject<any[]> };
type PassageRefs = OverlayRefs & { passageMeshesRef: React.MutableRefObject<any[]> };

const LAYER_COLORS = ['#4fc3f7', '#81c784', '#ffb74d', '#f06292'];

function describeTileId(tileId: number): string {
  if (tileId === 0) return '';
  if (isTileA1(tileId)) {
    const kind = Math.floor((tileId - TILE_ID_A1) / 48);
    return `A1\nk${kind} s${(tileId - TILE_ID_A1) % 48}`;
  }
  if (isTileA2(tileId)) return `A2\nk${Math.floor((tileId - 2816) / 48)} s${(tileId - 2816) % 48}`;
  if (isTileA3(tileId)) return `A3\nk${Math.floor((tileId - 4352) / 48)} s${(tileId - 4352) % 48}`;
  if (isTileA4(tileId)) return `A4\nk${Math.floor((tileId - 5888) / 48)} s${(tileId - 5888) % 48}`;
  if (isTileA5(tileId)) return `A5\n#${tileId - 1536}`;
  if (tileId < 256) return `B\n#${tileId}`;
  if (tileId < 512) return `C\n#${tileId - 256}`;
  if (tileId < 768) return `D\n#${tileId - 512}`;
  if (tileId < 1024) return `E\n#${tileId - 768}`;
  return `#${tileId}`;
}

/** Tile ID 디버그 오버레이 */
export function useTileIdDebugOverlay(
  refs: DebugRefs,
  showTileId: boolean,
  rendererReady: number,
) {
  const mapWidth = useEditorStore((s) => s.currentMap?.width ?? 0);
  const mapHeight = useEditorStore((s) => s.currentMap?.height ?? 0);
  const mapData = useEditorStore((s) => s.currentMap?.data ?? null);

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    for (const m of refs.tileIdDebugMeshesRef.current) {
      rendererObj.scene.remove(m);
      m.geometry?.dispose();
      if (m.material?.map) m.material.map.dispose();
      m.material?.dispose();
    }
    refs.tileIdDebugMeshesRef.current = [];

    if (!showTileId || !mapData || mapWidth <= 0 || mapHeight <= 0) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    const sharedGeom = new THREE.PlaneGeometry(TILE_SIZE_PX, TILE_SIZE_PX);

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const lines: { text: string; color: string }[] = [];
        for (let z = 0; z < 4; z++) {
          const tileId = mapData[(z * mapHeight + y) * mapWidth + x];
          if (!tileId) continue;
          const desc = describeTileId(tileId);
          if (desc) lines.push({ text: `L${z}:${desc.replace('\n', ' ')}`, color: LAYER_COLORS[z] });
        }
        if (lines.length === 0) continue;

        const cvsW = 128, cvsH = 128;
        const cvs = document.createElement('canvas');
        cvs.width = cvsW; cvs.height = cvsH;
        const ctx = cvs.getContext('2d')!;
        ctx.clearRect(0, 0, cvsW, cvsH);

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        const r = 6, bx = 4, by = 4, bw = cvsW - 8, bh = cvsH - 8;
        ctx.moveTo(bx + r, by);
        ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
        ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
        ctx.arcTo(bx, by + bh, bx, by, r);
        ctx.arcTo(bx, by, bx + bw, by, r);
        ctx.fill();

        const fontSize = lines.length <= 2 ? 22 : lines.length <= 3 ? 18 : 15;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 2;

        const totalH = lines.length * (fontSize + 4);
        const startY = (cvsH - totalH) / 2 + (fontSize + 4) / 2;
        for (let i = 0; i < lines.length; i++) {
          ctx.fillStyle = lines[i].color;
          ctx.fillText(lines[i].text, cvsW / 2, startY + i * (fontSize + 4), cvsW - 12);
        }

        const tex = new THREE.CanvasTexture(cvs);
        tex.minFilter = THREE.LinearFilter;
        const mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(sharedGeom, mat);
        mesh.position.set(x * TILE_SIZE_PX + TILE_SIZE_PX / 2, y * TILE_SIZE_PX + TILE_SIZE_PX / 2, 4.8);
        mesh.renderOrder = 9997;
        mesh.frustumCulled = false;
        mesh.userData.editorGrid = true;
        rendererObj.scene.add(mesh);
        refs.tileIdDebugMeshesRef.current.push(mesh);
      }
    }

    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [showTileId, mapData, mapWidth, mapHeight, rendererReady]);
}

function drawPassageSymbol(ctx: CanvasRenderingContext2D, val: number) {
  ctx.clearRect(0, 0, 48, 48);
  if (val === 0x0F) {
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.9)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(10, 10); ctx.lineTo(38, 38);
    ctx.moveTo(38, 10); ctx.lineTo(10, 38);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(255, 60, 60, 0.8)';
    const barW = 28, barH = 6;
    if (val & 0x01) ctx.fillRect((48 - barW) / 2, 48 - barH - 2, barW, barH);
    if (val & 0x02) ctx.fillRect(2, (48 - barW) / 2, barH, barW);
    if (val & 0x04) ctx.fillRect(48 - barH - 2, (48 - barW) / 2, barH, barW);
    if (val & 0x08) ctx.fillRect((48 - barW) / 2, 2, barW, barH);
  }
}

/** 통행불가 (custom passage) 오버레이 */
export function usePassageOverlay(refs: PassageRefs, rendererReady: number) {
  const editMode = useEditorStore((s) => s.editMode);
  const mapWidth = useEditorStore((s) => s.currentMap?.width ?? 0);
  const mapHeight = useEditorStore((s) => s.currentMap?.height ?? 0);
  const customPassage = useEditorStore((s) => s.currentMap?.customPassage ?? null);
  const passageHash = useEditorStore((s) => {
    if (!s.currentMap?.customPassage || s.editMode !== 'passage') return '';
    const cp = s.currentMap.customPassage;
    const parts: string[] = [];
    for (let i = 0; i < cp.length; i++) {
      if (cp[i]) parts.push(`${i}:${cp[i]}`);
    }
    return parts.join(';');
  });

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    for (const m of refs.passageMeshesRef.current) {
      rendererObj.scene.remove(m);
      m.geometry?.dispose();
      if (m.material?.map) m.material.map.dispose();
      m.material?.dispose();
    }
    refs.passageMeshesRef.current = [];

    if (editMode !== 'passage' || !customPassage || mapWidth <= 0 || mapHeight <= 0) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    const sharedGeom = new THREE.PlaneGeometry(TILE_SIZE_PX, TILE_SIZE_PX);

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const val = customPassage[y * mapWidth + x];
        if (!val) continue;

        const cvs = document.createElement('canvas');
        cvs.width = 48; cvs.height = 48;
        drawPassageSymbol(cvs.getContext('2d')!, val);

        const tex = new THREE.CanvasTexture(cvs);
        tex.minFilter = THREE.LinearFilter;
        const mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(sharedGeom, mat);
        mesh.position.set(x * TILE_SIZE_PX + TILE_SIZE_PX / 2, y * TILE_SIZE_PX + TILE_SIZE_PX / 2, 4);
        mesh.renderOrder = 9970;
        mesh.frustumCulled = false;
        mesh.userData.editorGrid = true;
        rendererObj.scene.add(mesh);
        refs.passageMeshesRef.current.push(mesh);
      }
    }

    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [editMode, passageHash, mapWidth, mapHeight, rendererReady]);
}

/** 통행 선택 영역 오버레이 */
export function usePassageSelectionOverlay(refs: PassageRefs, rendererReady: number) {
  const editMode = useEditorStore((s) => s.editMode);
  const passageTool = useEditorStore((s) => s.passageTool);
  const passageSelectionStart = useEditorStore((s) => s.passageSelectionStart);
  const passageSelectionEnd = useEditorStore((s) => s.passageSelectionEnd);

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    if (!(window as any)._editorPassageSelMeshes) (window as any)._editorPassageSelMeshes = [];
    const existing = (window as any)._editorPassageSelMeshes as any[];
    for (const m of existing) {
      rendererObj.scene.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
    }
    existing.length = 0;

    if (editMode !== 'passage' || passageTool !== 'select' || !passageSelectionStart || !passageSelectionEnd) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    const minX = Math.min(passageSelectionStart.x, passageSelectionEnd.x);
    const maxX = Math.max(passageSelectionStart.x, passageSelectionEnd.x);
    const minY = Math.min(passageSelectionStart.y, passageSelectionEnd.y);
    const maxY = Math.max(passageSelectionStart.y, passageSelectionEnd.y);

    const rw = (maxX - minX + 1) * TILE_SIZE_PX;
    const rh = (maxY - minY + 1) * TILE_SIZE_PX;
    const cx = minX * TILE_SIZE_PX + rw / 2;
    const cy = minY * TILE_SIZE_PX + rh / 2;

    const geom = new THREE.PlaneGeometry(rw, rh);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff6666, opacity: 0.15, transparent: true, depthTest: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(cx, cy, 6.5);
    mesh.renderOrder = 9975;
    mesh.frustumCulled = false;
    mesh.userData.editorGrid = true;
    rendererObj.scene.add(mesh);
    existing.push(mesh);

    const line = createDashedRectBorder(THREE, cx, cy, rw / 2, rh / 2, 6.8, 0xff6666, 9976, 6, 4);
    rendererObj.scene.add(line);
    existing.push(line);

    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [editMode, passageTool, passageSelectionStart, passageSelectionEnd, rendererReady]);
}

/** 통행 붙여넣기 프리뷰 오버레이 */
export function usePassagePastePreviewOverlay(refs: PassageRefs, rendererReady: number) {
  const editMode = useEditorStore((s) => s.editMode);
  const isPassagePasting = useEditorStore((s) => s.isPassagePasting);
  const passagePastePreviewPos = useEditorStore((s) => s.passagePastePreviewPos);
  const clipboard = useEditorStore((s) => s.clipboard);

  useEffect(() => {
    const rendererObj = refs.rendererObjRef.current;
    if (!rendererObj) return;
    const THREE = (window as any).THREE;
    if (!THREE) return;

    if (!(window as any)._editorPassagePasteMeshes) (window as any)._editorPassagePasteMeshes = [];
    const existing = (window as any)._editorPassagePasteMeshes as any[];
    for (const m of existing) {
      rendererObj.scene.remove(m);
      m.geometry?.dispose();
      if (m.material?.map) m.material.map.dispose();
      m.material?.dispose();
    }
    existing.length = 0;

    if (editMode !== 'passage' || !isPassagePasting || !passagePastePreviewPos ||
        !clipboard || clipboard.type !== 'passage' || !clipboard.passage || !clipboard.width || !clipboard.height) {
      requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
      return;
    }

    const tw = TILE_SIZE_PX;
    const tilesW = clipboard.width;
    const tilesH = clipboard.height;

    const cvs = document.createElement('canvas');
    cvs.width = tw * tilesW;
    cvs.height = tw * tilesH;
    const ctx = cvs.getContext('2d')!;
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    for (const p of clipboard.passage) {
      if (!p.value) continue;
      // drawPassageSymbol을 오프셋 적용하여 그리기
      ctx.save();
      ctx.translate(p.x * tw, p.y * tw);
      if (p.value === 0x0F) {
        ctx.strokeStyle = 'rgba(255, 60, 60, 0.9)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(10, 10); ctx.lineTo(38, 38);
        ctx.moveTo(38, 10); ctx.lineTo(10, 38);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255, 60, 60, 0.8)';
        const barW = 28, barH = 6;
        if (p.value & 0x01) ctx.fillRect((48 - barW) / 2, 48 - barH - 2, barW, barH);
        if (p.value & 0x02) ctx.fillRect(2, (48 - barW) / 2, barH, barW);
        if (p.value & 0x04) ctx.fillRect(48 - barH - 2, (48 - barW) / 2, barH, barW);
        if (p.value & 0x08) ctx.fillRect((48 - barW) / 2, 2, barW, barH);
      }
      ctx.restore();
    }

    const tex = new THREE.CanvasTexture(cvs);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.flipY = false;

    const rw = tw * tilesW, rh = tw * tilesH;
    const cx = passagePastePreviewPos.x * tw + rw / 2;
    const cy = passagePastePreviewPos.y * tw + rh / 2;

    const geom = new THREE.PlaneGeometry(rw, rh);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.5, depthTest: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(cx, cy, 8);
    mesh.renderOrder = 9977;
    mesh.frustumCulled = false;
    mesh.userData.editorGrid = true;
    rendererObj.scene.add(mesh);
    existing.push(mesh);

    const line = createDashedRectBorder(THREE, cx, cy, rw / 2, rh / 2, 8.5, 0xff6666, 9978, 6, 4);
    rendererObj.scene.add(line);
    existing.push(line);

    requestRenderFrames(refs.rendererObjRef, refs.stageRef, refs.renderRequestedRef);
  }, [editMode, isPassagePasting, passagePastePreviewPos, clipboard, rendererReady]);
}
