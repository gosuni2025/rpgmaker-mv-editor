import React, { useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX, getTileRenderInfo } from '../../utils/tileHelper';

export function useOverlayRenderer(
  overlayRef: React.RefObject<HTMLCanvasElement>,
  tilesetImages: Record<number, HTMLImageElement>,
  charImages: Record<string, HTMLImageElement>,
  playerCharImg: HTMLImageElement | null,
  showGrid: boolean,
  dragPreview: { x: number; y: number } | null,
  isDraggingEvent: React.MutableRefObject<boolean>,
  lightDragPreview: { x: number; y: number } | null,
  isDraggingLight: React.MutableRefObject<boolean>,
  objectDragPreview: { x: number; y: number } | null,
  isDraggingObject: React.MutableRefObject<boolean>,
  draggedObjectId: React.MutableRefObject<number | null>,
): void {
  const currentMap = useEditorStore((s) => s.currentMap);
  const editMode = useEditorStore((s) => s.editMode);
  const currentLayer = useEditorStore((s) => s.currentLayer);
  const mode3d = useEditorStore((s) => s.mode3d);
  const shadowLight = useEditorStore((s) => s.shadowLight);
  const lightEditMode = useEditorStore((s) => s.lightEditMode);
  const selectedLightId = useEditorStore((s) => s.selectedLightId);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const systemData = useEditorStore((s) => s.systemData);
  const currentMapId = useEditorStore((s) => s.currentMapId);
  const playerCharacterName = useEditorStore((s) => s.playerCharacterName);
  const playerCharacterIndex = useEditorStore((s) => s.playerCharacterIndex);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    if (!currentMap) {
      overlay.width = 400;
      overlay.height = 300;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No map selected', overlay.width / 2, overlay.height / 2);
      return;
    }

    const { width, height, data, events } = currentMap;
    const cw = width * TILE_SIZE_PX;
    const ch = height * TILE_SIZE_PX;

    if (overlay.width !== cw || overlay.height !== ch) {
      overlay.width = cw;
      overlay.height = ch;
    }

    ctx.clearRect(0, 0, cw, ch);

    // Grid (skip in 3D mode - grid is rendered as Three.js mesh)
    if (showGrid && !mode3d) {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * TILE_SIZE_PX + 0.5, 0);
        ctx.lineTo(x * TILE_SIZE_PX + 0.5, ch);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * TILE_SIZE_PX + 0.5);
        ctx.lineTo(cw, y * TILE_SIZE_PX + 0.5);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * TILE_SIZE_PX + 1.5, 0);
        ctx.lineTo(x * TILE_SIZE_PX + 1.5, ch);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * TILE_SIZE_PX + 1.5);
        ctx.lineTo(cw, y * TILE_SIZE_PX + 1.5);
        ctx.stroke();
      }
    }

    // Region overlay (layer 5) - skip in 3D mode
    if (currentLayer === 5 && !mode3d) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const regionId = data[(5 * height + y) * width + x];
          if (regionId === 0) continue;
          const rx = x * TILE_SIZE_PX;
          const ry = y * TILE_SIZE_PX;
          const hue = (regionId * 137) % 360;
          ctx.fillStyle = `hsla(${hue}, 60%, 40%, 0.5)`;
          ctx.fillRect(rx, ry, TILE_SIZE_PX, TILE_SIZE_PX);
          ctx.save();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 2;
          ctx.fillText(String(regionId), rx + TILE_SIZE_PX / 2, ry + TILE_SIZE_PX / 2);
          ctx.restore();
        }
      }
    }

    // Events - skip in 3D mode
    if (events && !mode3d) {
      const showEventDetails = editMode === 'event';
      events.forEach((ev) => {
        if (!ev || ev.id === 0) return;
        const ex = ev.x * TILE_SIZE_PX;
        const ey = ev.y * TILE_SIZE_PX;

        let drewImage = false;
        if (ev.pages && ev.pages.length > 0) {
          const page = ev.pages[0];
          const img = page.image;
          if (img && img.characterName && charImages[img.characterName]) {
            const charImg = charImages[img.characterName];
            const isSingle = img.characterName.startsWith('$');
            const charW = isSingle ? charImg.width / 3 : charImg.width / 12;
            const charH = isSingle ? charImg.height / 4 : charImg.height / 8;
            const charCol = isSingle ? 0 : img.characterIndex % 4;
            const charRow = isSingle ? 0 : Math.floor(img.characterIndex / 4);
            const dirRow = img.direction === 8 ? 3 : img.direction === 6 ? 2 : img.direction === 4 ? 1 : 0;
            const pattern = img.pattern || 1;
            const sx = charCol * charW * 3 + pattern * charW;
            const sy = charRow * charH * 4 + dirRow * charH;
            const scale = Math.min(TILE_SIZE_PX / charW, TILE_SIZE_PX / charH);
            const dw = charW * scale;
            const dh = charH * scale;
            const dx = ex + (TILE_SIZE_PX - dw) / 2;
            const dy = ey + (TILE_SIZE_PX - dh);
            ctx.drawImage(charImg, sx, sy, charW, charH, dx, dy, dw, dh);
            drewImage = true;
          }
        }

        if (showEventDetails) {
          if (!drewImage) {
            ctx.fillStyle = 'rgba(0,120,212,0.35)';
            ctx.fillRect(ex, ey, TILE_SIZE_PX, TILE_SIZE_PX);
          }
          ctx.strokeStyle = '#0078d4';
          ctx.lineWidth = 2;
          ctx.strokeRect(ex + 1, ey + 1, TILE_SIZE_PX - 2, TILE_SIZE_PX - 2);

          if (ev.name) {
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 2;
            ctx.fillText(ev.name, ex + TILE_SIZE_PX / 2, ey + 2, TILE_SIZE_PX - 4);
            ctx.restore();
          }
        } else if (!drewImage) {
          ctx.fillStyle = 'rgba(0,120,212,0.25)';
          ctx.fillRect(ex, ey, TILE_SIZE_PX, TILE_SIZE_PX);
        }
      });
    }

    // Objects overlay
    if (currentMap?.objects && !mode3d) {
      const isObjectMode = editMode === 'object';
      for (const obj of currentMap.objects) {
        for (let row = 0; row < obj.height; row++) {
          for (let col = 0; col < obj.width; col++) {
            const tileId = obj.tileIds[row]?.[col];
            if (!tileId || tileId === 0) continue;
            const drawX = (obj.x + col) * TILE_SIZE_PX;
            const drawY = (obj.y - obj.height + 1 + row) * TILE_SIZE_PX;
            const info = getTileRenderInfo(tileId);
            if (!info) continue;
            if (info.type === 'normal') {
              const img = tilesetImages[info.sheet];
              if (img) {
                ctx.drawImage(img, info.sx, info.sy, info.sw, info.sh, drawX, drawY, TILE_SIZE_PX, TILE_SIZE_PX);
              }
            } else if (info.type === 'autotile') {
              const HALF = TILE_SIZE_PX / 2;
              for (let q = 0; q < 4; q++) {
                const quarter = info.quarters[q];
                const img = tilesetImages[quarter.sheet];
                if (!img) continue;
                const qx = drawX + (q % 2) * HALF;
                const qy = drawY + Math.floor(q / 2) * HALF;
                ctx.drawImage(img, quarter.sx, quarter.sy, HALF, HALF, qx, qy, HALF, HALF);
              }
            }
          }
        }
        if (isObjectMode) {
          const bx = obj.x * TILE_SIZE_PX;
          const by = (obj.y - obj.height + 1) * TILE_SIZE_PX;
          const bw = obj.width * TILE_SIZE_PX;
          const bh = obj.height * TILE_SIZE_PX;
          const isSelected = selectedObjectId === obj.id;
          if (obj.passability) {
            for (let row = 0; row < obj.height; row++) {
              for (let col = 0; col < obj.width; col++) {
                if (obj.passability[row]?.[col] === false) {
                  const tx = (obj.x + col) * TILE_SIZE_PX;
                  const ty = (obj.y - obj.height + 1 + row) * TILE_SIZE_PX;
                  const pad = 4;
                  ctx.save();
                  ctx.strokeStyle = 'rgba(255,60,60,0.8)';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.moveTo(tx + pad, ty + pad);
                  ctx.lineTo(tx + TILE_SIZE_PX - pad, ty + TILE_SIZE_PX - pad);
                  ctx.moveTo(tx + TILE_SIZE_PX - pad, ty + pad);
                  ctx.lineTo(tx + pad, ty + TILE_SIZE_PX - pad);
                  ctx.stroke();
                  ctx.restore();
                }
              }
            }
          }
          ctx.strokeStyle = isSelected ? '#00ff66' : '#00cc66';
          ctx.lineWidth = isSelected ? 3 : 1;
          ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
          if (obj.name) {
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 2;
            ctx.fillText(obj.name, bx + bw / 2, by + 2, bw - 4);
            ctx.restore();
          }
        }
      }
      if (objectDragPreview && isDraggingObject.current && draggedObjectId.current != null) {
        const obj = currentMap.objects.find(o => o.id === draggedObjectId.current);
        if (obj) {
          const px = objectDragPreview.x * TILE_SIZE_PX;
          const py = (objectDragPreview.y - obj.height + 1) * TILE_SIZE_PX;
          ctx.save();
          ctx.globalAlpha = 0.6;
          for (let row = 0; row < obj.height; row++) {
            for (let col = 0; col < obj.width; col++) {
              const tileId = obj.tileIds[row]?.[col];
              if (!tileId || tileId === 0) continue;
              const drawX = px + col * TILE_SIZE_PX;
              const drawY = py + row * TILE_SIZE_PX;
              const info = getTileRenderInfo(tileId);
              if (!info) continue;
              if (info.type === 'normal') {
                const img = tilesetImages[info.sheet];
                if (img) ctx.drawImage(img, info.sx, info.sy, info.sw, info.sh, drawX, drawY, TILE_SIZE_PX, TILE_SIZE_PX);
              } else if (info.type === 'autotile') {
                const HALF = TILE_SIZE_PX / 2;
                for (let q = 0; q < 4; q++) {
                  const quarter = info.quarters[q];
                  const img = tilesetImages[quarter.sheet];
                  if (!img) continue;
                  ctx.drawImage(img, quarter.sx, quarter.sy, HALF, HALF, drawX + (q % 2) * HALF, drawY + Math.floor(q / 2) * HALF, HALF, HALF);
                }
              }
            }
          }
          ctx.restore();
          ctx.strokeStyle = '#00ff66';
          ctx.lineWidth = 2;
          ctx.strokeRect(px, py, obj.width * TILE_SIZE_PX, obj.height * TILE_SIZE_PX);
        }
      }
    }

    // Player start position - skip in 3D mode
    if (systemData && currentMapId === systemData.startMapId && !mode3d) {
      const px = systemData.startX * TILE_SIZE_PX;
      const py = systemData.startY * TILE_SIZE_PX;

      ctx.save();
      if (playerCharImg) {
        const isSingle = playerCharacterName?.startsWith('$');
        const charW = isSingle ? playerCharImg.width / 3 : playerCharImg.width / 12;
        const charH = isSingle ? playerCharImg.height / 4 : playerCharImg.height / 8;
        const charCol = isSingle ? 0 : playerCharacterIndex % 4;
        const charRow = isSingle ? 0 : Math.floor(playerCharacterIndex / 4);
        const srcX = charCol * charW * 3 + 1 * charW;
        const srcY = charRow * charH * 4 + 0 * charH;
        const scale = Math.min(TILE_SIZE_PX / charW, TILE_SIZE_PX / charH);
        const dw = charW * scale;
        const dh = charH * scale;
        const dx = px + (TILE_SIZE_PX - dw) / 2;
        const dy = py + (TILE_SIZE_PX - dh);
        ctx.drawImage(playerCharImg, srcX, srcY, charW, charH, dx, dy, dw, dh);
      }
      ctx.strokeStyle = '#0078ff';
      ctx.lineWidth = 3;
      ctx.strokeRect(px + 1.5, py + 1.5, TILE_SIZE_PX - 3, TILE_SIZE_PX - 3);
      ctx.restore();
    }

    // Light markers (visible when shadowLight is ON, 2D overlay only in non-3D mode)
    if (shadowLight && !mode3d && currentMap?.editorLights?.points) {
      for (const light of currentMap.editorLights.points) {
        const lx = light.x * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const lyBase = light.y * TILE_SIZE_PX + TILE_SIZE_PX / 2;
        const zOffset = (light.z ?? 0) * 0.5;
        const ly = lyBase - zOffset;

        if (lightEditMode) {
          if (zOffset > 2) {
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = light.color + '80';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(lx, lyBase);
            ctx.lineTo(lx, ly);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(lx, lyBase, 3, 0, Math.PI * 2);
            ctx.fillStyle = light.color + '60';
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(lx, ly, light.distance, 0, Math.PI * 2);
          ctx.strokeStyle = light.color + '30';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = light.color + '10';
          ctx.fill();

          const isSelected = selectedLightId === light.id;
          ctx.beginPath();
          ctx.arc(lx, ly, isSelected ? 12 : 9, 0, Math.PI * 2);
          ctx.fillStyle = light.color;
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#fff' : '#000';
          ctx.lineWidth = isSelected ? 3 : 1.5;
          ctx.stroke();
        }

        // 💡 아이콘 (항상 표시)
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 3;
        ctx.fillText('💡', lx, ly);
        ctx.shadowBlur = 0;
      }
    }

    // Light drag preview
    if (lightDragPreview && isDraggingLight.current) {
      const dx = lightDragPreview.x * TILE_SIZE_PX;
      const dy = lightDragPreview.y * TILE_SIZE_PX;
      ctx.fillStyle = 'rgba(255,204,136,0.4)';
      ctx.fillRect(dx, dy, TILE_SIZE_PX, TILE_SIZE_PX);
      ctx.strokeStyle = '#ffcc88';
      ctx.lineWidth = 2;
      ctx.strokeRect(dx + 1, dy + 1, TILE_SIZE_PX - 2, TILE_SIZE_PX - 2);
    }

    // Drag preview (events)
    if (dragPreview && isDraggingEvent.current) {
      const dx = dragPreview.x * TILE_SIZE_PX;
      const dy = dragPreview.y * TILE_SIZE_PX;
      ctx.fillStyle = 'rgba(0,180,80,0.4)';
      ctx.fillRect(dx, dy, TILE_SIZE_PX, TILE_SIZE_PX);
      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(dx + 1, dy + 1, TILE_SIZE_PX - 2, TILE_SIZE_PX - 2);
    }
  }, [currentMap, charImages, showGrid, editMode, currentLayer, systemData, currentMapId, playerCharImg, playerCharacterName, playerCharacterIndex, dragPreview, mode3d, shadowLight, lightEditMode, selectedLightId, lightDragPreview, tilesetImages, selectedObjectId, objectDragPreview]);
}
