import React, { useEffect } from 'react';
import useEditorStore from '../../store/useEditorStore';
import { TILE_SIZE_PX } from '../../utils/tileHelper';

export function useOverlayRenderer(
  overlayRef: React.RefObject<HTMLCanvasElement | null>,
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

    const { width, height, data } = currentMap;
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

    // Object drag preview
    if (objectDragPreview && isDraggingObject.current && draggedObjectId.current != null) {
      const obj = currentMap.objects?.find((o: any) => o.id === draggedObjectId.current);
      if (obj) {
        const px = objectDragPreview.x * TILE_SIZE_PX;
        const py = (objectDragPreview.y - obj.height + 1) * TILE_SIZE_PX;
        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, obj.width * TILE_SIZE_PX, obj.height * TILE_SIZE_PX);
      }
    }
  }, [currentMap, showGrid, editMode, currentLayer, dragPreview, mode3d, shadowLight, lightEditMode, selectedLightId, lightDragPreview, selectedObjectId, objectDragPreview]);
}
