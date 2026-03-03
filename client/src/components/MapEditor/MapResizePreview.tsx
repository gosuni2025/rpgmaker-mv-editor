import React from 'react';
import { TILE_SIZE_PX } from '../../utils/tileHelper';

interface ResizePreviewData {
  dLeft: number;
  dTop: number;
  dRight: number;
  dBottom: number;
}

interface MapResizePreviewProps {
  resizePreview: ResizePreviewData;
  origW: number;
  origH: number;
}

export default function MapResizePreview({ resizePreview, origW, origH }: MapResizePreviewProps) {
  const { dLeft, dTop, dRight, dBottom } = resizePreview;
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
}
