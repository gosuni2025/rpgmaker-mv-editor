import React from 'react';
import { TILE_SIZE_PX } from '../../utils/tileHelper';
import type { CameraZone } from '../../types/rpgMakerMV';

interface CameraZoneOverlaysProps {
  cameraZones: CameraZone[];
  selectedCameraZoneIds: number[];
  cameraZoneMultiDragDelta: { dx: number; dy: number } | null;
  cameraZoneDragPreview: { x: number; y: number; width: number; height: number } | null;
}

export default function CameraZoneOverlays({
  cameraZones,
  selectedCameraZoneIds,
  cameraZoneMultiDragDelta,
  cameraZoneDragPreview,
}: CameraZoneOverlaysProps) {
  return (
    <>
      {/* Camera Zone HTML overlays */}
      {cameraZones.map((zone) => {
        const isSelected = selectedCameraZoneIds.includes(zone.id);
        const isDragged = isSelected && cameraZoneMultiDragDelta;
        const zx = (zone.x + (isDragged ? cameraZoneMultiDragDelta.dx : 0)) * TILE_SIZE_PX;
        const zy = (zone.y + (isDragged ? cameraZoneMultiDragDelta.dy : 0)) * TILE_SIZE_PX;
        const zw = zone.width * TILE_SIZE_PX;
        const zh = zone.height * TILE_SIZE_PX;
        return (
          <React.Fragment key={zone.id}>
            <div style={{
              position: 'absolute', left: zx, top: zy, width: zw, height: zh,
              background: isSelected ? 'rgba(255,136,0,0.25)' : 'rgba(34,136,255,0.15)',
              border: `2px dashed ${isSelected ? '#ffaa44' : '#44aaff'}`,
              boxSizing: 'border-box',
              pointerEvents: 'none',
              zIndex: 2,
            }} />
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
      {cameraZoneDragPreview && (
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
    </>
  );
}
