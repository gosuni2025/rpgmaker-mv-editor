import React, { useRef, useEffect, useState, useCallback } from 'react';
import useEditorStore from '../store/useEditorStore';
import useEscClose from '../hooks/useEscClose';
import { getTileRenderInfo, TILE_SIZE_PX } from '../utils/tileHelper';
import { buildAutotileEntries } from '../utils/autotileEntries';
import { loadTilesetImages } from '../utils/tilesetImageLoader';
import { drawSheetSource, drawAllShapes } from './autotileDebugRenderer';

interface Props {
  open: boolean;
  onClose: () => void;
}

const HALF = TILE_SIZE_PX / 2;

const AUTOTILE_ENTRIES = buildAutotileEntries();

export default function AutotileDebugDialog({ open, onClose }: Props) {
  useEscClose(useCallback(() => { if (open) onClose(); }, [open, onClose]));
  const currentMap = useEditorStore((s) => s.currentMap);
  const [tilesetImages, setTilesetImages] = useState<Record<number, HTMLImageElement>>({});
  const [selectedKind, setSelectedKind] = useState<number | null>(null);
  const paletteCanvasRef = useRef<HTMLCanvasElement>(null);
  const sheetCanvasRef = useRef<HTMLCanvasElement>(null);
  const shapesCanvasRef = useRef<HTMLCanvasElement>(null);

  // Load tileset images
  useEffect(() => {
    if (!open || !currentMap?.tilesetNames) return;
    return loadTilesetImages(currentMap.tilesetNames, setTilesetImages);
  }, [open, currentMap?.tilesetId, currentMap?.tilesetNames]);

  // Draw autotile palette (left side)
  const drawPalette = useCallback(() => {
    const canvas = paletteCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cols = 8;
    const rows = Math.ceil(AUTOTILE_ENTRIES.length / cols);
    const cellSize = TILE_SIZE_PX;
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;

    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < AUTOTILE_ENTRIES.length; i++) {
      const entry = AUTOTILE_ENTRIES[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const dx = col * cellSize;
      const dy = row * cellSize;

      const info = getTileRenderInfo(entry.tileId);
      if (info && info.type === 'autotile') {
        const q = info.quarters;
        for (let j = 0; j < 4; j++) {
          const img = tilesetImages[q[j].sheet];
          if (!img) continue;
          ctx.drawImage(img, q[j].sx, q[j].sy, HALF, HALF,
            dx + (j % 2) * HALF, dy + Math.floor(j / 2) * HALF, HALF, HALF);
        }
      }

      // Highlight selected
      if (selectedKind === entry.kind) {
        ctx.strokeStyle = '#ff0';
        ctx.lineWidth = 3;
        ctx.strokeRect(dx + 1, dy + 1, cellSize - 2, cellSize - 2);
      }

      // Category separator lines
      if (col === 0) {
        const prevEntry = i > 0 ? AUTOTILE_ENTRIES[i - cols] : null;
        if (prevEntry && prevEntry.category !== entry.category) {
          ctx.strokeStyle = '#666';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, dy);
          ctx.lineTo(canvas.width, dy);
          ctx.stroke();
          // Category label
          ctx.fillStyle = '#aaa';
          ctx.font = '10px monospace';
          ctx.fillText(entry.category, 2, dy + 10);
        }
      }
    }
  }, [tilesetImages, selectedKind]);

  useEffect(() => { if (open) drawPalette(); }, [open, drawPalette]);

  // Draw sprite sheet source area for selected autotile kind
  const drawSheetSourceCb = useCallback(() => {
    const canvas = sheetCanvasRef.current;
    if (!canvas || selectedKind === null) return;
    drawSheetSource(canvas, selectedKind, tilesetImages);
  }, [selectedKind, tilesetImages]);

  // Draw all 48 shapes for the selected kind
  const drawAllShapesCb = useCallback(() => {
    const canvas = shapesCanvasRef.current;
    if (!canvas || selectedKind === null) return;
    drawAllShapes(canvas, selectedKind, tilesetImages);
  }, [selectedKind, tilesetImages]);

  useEffect(() => {
    if (open && selectedKind !== null) {
      drawSheetSourceCb();
      drawAllShapesCb();
    }
  }, [open, selectedKind, drawSheetSourceCb, drawAllShapesCb]);

  const handlePaletteClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = paletteCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    const cols = 8;
    const col = Math.floor(cx / TILE_SIZE_PX);
    const row = Math.floor(cy / TILE_SIZE_PX);
    const idx = row * cols + col;
    if (idx >= 0 && idx < AUTOTILE_ENTRIES.length) {
      setSelectedKind(AUTOTILE_ENTRIES[idx].kind);
    }
  }, []);

  if (!open) return null;

  return (
    <div className="db-dialog-overlay">
      <div className="db-dialog"
        style={{ width: '1100px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="db-dialog-header">
          <h2>오토타일 디버그</h2>
          <button className="db-dialog-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '12px', padding: '12px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left: autotile palette list */}
          <div style={{ width: '400px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ marginBottom: '6px', color: '#ddd', fontSize: '12px' }}>
              오토타일 목록 (클릭하여 선택)
            </div>
            <div style={{ flex: 1, overflow: 'auto', border: '1px solid #555', background: '#1e1e1e' }}>
              <canvas ref={paletteCanvasRef} onClick={handlePaletteClick}
                style={{ display: 'block', width: '100%', cursor: 'pointer', imageRendering: 'pixelated' }} />
            </div>
          </div>

          {/* Right: sprite sheet source + all shapes */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
            {selectedKind !== null ? (
              <>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ color: '#ddd', fontSize: '12px', marginBottom: '4px' }}>
                    스프라이트 시트 소스 영역
                  </div>
                  <canvas ref={sheetCanvasRef} style={{ imageRendering: 'pixelated' }} />
                </div>
                <div>
                  <div style={{ color: '#ddd', fontSize: '12px', marginBottom: '4px' }}>
                    전체 48 shape 미리보기
                  </div>
                  <canvas ref={shapesCanvasRef} style={{ imageRendering: 'pixelated' }} />
                </div>
              </>
            ) : (
              <div style={{ color: '#888', padding: '40px', textAlign: 'center' }}>
                왼쪽에서 오토타일을 선택하세요
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
