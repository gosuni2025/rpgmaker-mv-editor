import React, { useRef, useEffect, useState, useCallback } from 'react';
import useEditorStore from '../store/useEditorStore';
import {
  getTileRenderInfo, TILE_SIZE_PX, makeAutotileId,
  getAutotileBlockInfo, getShapeNeighbors,
  getFloorHalfTileMeanings, getWallHalfTileMeanings,
  TILE_ID_A1,
} from '../utils/tileHelper';

interface Props {
  open: boolean;
  onClose: () => void;
}

const HALF = TILE_SIZE_PX / 2;

// Build autotile kind entries (same as TilesetPalette)
interface AutotileEntry {
  kind: number;
  label: string;
  tileId: number; // base tile ID (shape 46 = fully connected)
  category: string;
}

function buildAutotileEntries(): AutotileEntry[] {
  const entries: AutotileEntry[] = [];
  for (let k = 0; k < 16; k++) {
    entries.push({ kind: k, label: `A1-${k}`, tileId: TILE_ID_A1 + k * 48 + 46, category: 'A1' });
  }
  for (let k = 16; k < 48; k++) {
    entries.push({ kind: k, label: `A2-${k - 16}`, tileId: TILE_ID_A1 + k * 48 + 46, category: 'A2' });
  }
  for (let k = 48; k < 80; k++) {
    entries.push({ kind: k, label: `A3-${k - 48}`, tileId: TILE_ID_A1 + k * 48 + 46, category: 'A3' });
  }
  for (let k = 80; k < 128; k++) {
    entries.push({ kind: k, label: `A4-${k - 80}`, tileId: TILE_ID_A1 + k * 48 + 46, category: 'A4' });
  }
  return entries;
}

const AUTOTILE_ENTRIES = buildAutotileEntries();

export default function AutotileDebugDialog({ open, onClose }: Props) {
  const currentMap = useEditorStore((s) => s.currentMap);
  const [tilesetImages, setTilesetImages] = useState<Record<number, HTMLImageElement>>({});
  const [selectedKind, setSelectedKind] = useState<number | null>(null);
  const paletteCanvasRef = useRef<HTMLCanvasElement>(null);
  const sheetCanvasRef = useRef<HTMLCanvasElement>(null);
  const shapesCanvasRef = useRef<HTMLCanvasElement>(null);

  // Load tileset images
  useEffect(() => {
    if (!open || !currentMap?.tilesetNames) return;
    const names = currentMap.tilesetNames;
    const loaded: Record<number, HTMLImageElement> = {};
    let cancelled = false;
    let remaining = 0;
    for (let idx = 0; idx <= 8; idx++) {
      const name = names[idx];
      if (!name) continue;
      remaining++;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        loaded[idx] = img;
        remaining--;
        if (remaining <= 0) setTilesetImages({ ...loaded });
      };
      img.onerror = () => {
        if (cancelled) return;
        remaining--;
        if (remaining <= 0) setTilesetImages({ ...loaded });
      };
      img.src = `/api/resources/img_tilesets/${name}.png`;
    }
    if (remaining === 0) setTilesetImages({});
    return () => { cancelled = true; };
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
  const drawSheetSource = useCallback(() => {
    const canvas = sheetCanvasRef.current;
    if (!canvas || selectedKind === null) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get block info for this kind
    const baseTileId = TILE_ID_A1 + selectedKind * 48;
    const blockInfo = getAutotileBlockInfo(baseTileId);
    if (!blockInfo) return;

    const { setNumber, bx, by, tableType } = blockInfo;
    const img = tilesetImages[setNumber];

    // Source area dimensions (in half-tiles)
    // Floor autotile: 4 half-tiles wide × 6 half-tiles tall (2 tiles × 3 tiles)
    // Wall autotile: 4 half-tiles wide × 4 half-tiles tall (2 tiles × 2 tiles)
    // Waterfall: 4 half-tiles wide × 6 half-tiles tall (with different layout)
    const srcHalfW = 4;
    const srcHalfH = tableType === 'wall' ? 4 : 6;
    const srcPxW = srcHalfW * HALF;
    const srcPxH = srcHalfH * HALF;
    const srcX = bx * 2 * HALF;
    const srcY = by * 2 * HALF;

    const scale = 3; // 3x zoom for visibility
    const padding = 20;
    const infoHeight = 80;

    canvas.width = srcPxW * scale + padding * 2;
    canvas.height = srcPxH * scale + padding * 2 + infoHeight;

    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Info text
    ctx.fillStyle = '#fff';
    ctx.font = '13px monospace';
    ctx.fillText(`kind: ${selectedKind}  sheet: ${setNumber}  type: ${tableType}`, padding, 20);
    ctx.fillText(`bx: ${bx}  by: ${by}`, padding, 38);
    ctx.fillText(`src: (${srcX}, ${srcY}) ${srcPxW}x${srcPxH}px`, padding, 56);

    const drawY = infoHeight;

    // Draw checkerboard background
    const checkSize = 8;
    for (let cy = 0; cy < srcPxH * scale; cy += checkSize) {
      for (let cx = 0; cx < srcPxW * scale; cx += checkSize) {
        ctx.fillStyle = ((cx / checkSize + cy / checkSize) % 2 === 0) ? '#333' : '#444';
        ctx.fillRect(padding + cx, drawY + padding + cy, checkSize, checkSize);
      }
    }

    // Draw the source sprite sheet area
    if (img) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, srcX, srcY, srcPxW, srcPxH,
        padding, drawY + padding, srcPxW * scale, srcPxH * scale);
    }

    // Draw grid lines (half-tile grid)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= srcHalfW; gx++) {
      const x = padding + gx * HALF * scale;
      ctx.beginPath();
      ctx.moveTo(x, drawY + padding);
      ctx.lineTo(x, drawY + padding + srcPxH * scale);
      ctx.stroke();
    }
    for (let gy = 0; gy <= srcHalfH; gy++) {
      const y = drawY + padding + gy * HALF * scale;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + srcPxW * scale, y);
      ctx.stroke();
    }

    // Label half-tile coordinates
    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    for (let gy = 0; gy < srcHalfH; gy++) {
      for (let gx = 0; gx < srcHalfW; gx++) {
        const x = padding + gx * HALF * scale + 2;
        const y = drawY + padding + gy * HALF * scale + 12;
        ctx.fillText(`${gx},${gy}`, x, y);
      }
    }

    // Stronger lines for full-tile grid
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
    ctx.lineWidth = 2;
    for (let gx = 0; gx <= srcHalfW / 2; gx++) {
      const x = padding + gx * TILE_SIZE_PX * scale;
      ctx.beginPath();
      ctx.moveTo(x, drawY + padding);
      ctx.lineTo(x, drawY + padding + srcPxH * scale);
      ctx.stroke();
    }
    for (let gy = 0; gy <= srcHalfH / 2; gy++) {
      const y = drawY + padding + gy * TILE_SIZE_PX * scale;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + srcPxW * scale, y);
      ctx.stroke();
    }

    // Draw 3x3 minimal bitmask on each half-tile in the sprite sheet.
    // Each half-tile is used by a specific quarter (TL/TR/BL/BR) with specific neighbor conditions.
    // Use getFloorHalfTileMeanings / getWallHalfTileMeanings to get the exact meaning.
    const halfTileScale = HALF * scale;
    const miniSub = halfTileScale / 3;

    const meaningMap = tableType === 'wall'
      ? getWallHalfTileMeanings()
      : tableType === 'floor'
      ? getFloorHalfTileMeanings()
      : null;

    if (meaningMap) {
      for (let gy = 0; gy < srcHalfH; gy++) {
        for (let gx = 0; gx < srcHalfW; gx++) {
          const key = `${gx},${gy}`;
          const meanings = meaningMap.get(key);
          if (!meanings || meanings.length === 0) continue;

          const hx = padding + gx * halfTileScale;
          const hy = drawY + padding + gy * halfTileScale;

          // Use the first meaning entry
          const m = meanings[0];

          // Build 3x3 grid: true = neighbor present (red), false = absent (no fill), null = don't care (dim)
          const grid: (boolean | null)[][] = [
            [m.topLeft, m.top, m.topRight],
            [m.left, true, m.right],
            [m.bottomLeft, m.bottom, m.bottomRight],
          ];

          for (let my = 0; my < 3; my++) {
            for (let mx = 0; mx < 3; mx++) {
              const val = grid[my][mx];
              const sx = hx + mx * miniSub;
              const sy = hy + my * miniSub;
              if (val === true) {
                ctx.fillStyle = 'rgba(255, 50, 50, 0.5)';
                ctx.fillRect(sx, sy, miniSub, miniSub);
              } else if (val === false) {
                // Not present - leave empty (dark)
              }
              // null = irrelevant to this quarter - leave transparent
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
              ctx.lineWidth = 0.5;
              ctx.strokeRect(sx, sy, miniSub, miniSub);
            }
          }
        }
      }
    }
  }, [selectedKind, tilesetImages]);

  // Draw 3x3 neighbor bitmask overlay on a shape cell
  const drawNeighborOverlay = useCallback((
    ctx: CanvasRenderingContext2D,
    dx: number, dy: number, cellSize: number,
    shape: number, tableType: 'floor' | 'wall' | 'waterfall'
  ) => {
    const neighbors = getShapeNeighbors(shape, tableType);
    const sub = cellSize / 3;
    // 3x3 grid: [row][col] mapping to directions
    // [tl, top, tr]
    // [left, center, right]
    // [bl, bottom, br]
    const grid: [string, boolean][][] = [
      [['topLeft', neighbors.topLeft], ['top', neighbors.top], ['topRight', neighbors.topRight]],
      [['left', neighbors.left], ['center', true], ['right', neighbors.right]],
      [['bottomLeft', neighbors.bottomLeft], ['bottom', neighbors.bottom], ['bottomRight', neighbors.bottomRight]],
    ];

    for (let gy = 0; gy < 3; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        const [, active] = grid[gy][gx];
        const sx = dx + gx * sub;
        const sy = dy + gy * sub;
        if (active) {
          ctx.fillStyle = 'rgba(255, 50, 50, 0.45)';
          ctx.fillRect(sx, sy, sub, sub);
        }
        // Grid line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(sx, sy, sub, sub);
      }
    }
  }, []);

  // Draw all 48 shapes for the selected kind
  const drawAllShapes = useCallback(() => {
    const canvas = shapesCanvasRef.current;
    if (!canvas || selectedKind === null) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Determine table type for this kind
    const baseTileId = TILE_ID_A1 + selectedKind * 48;
    const blockInfo = getAutotileBlockInfo(baseTileId);
    const tableType = blockInfo?.tableType ?? 'floor';
    const shapeCount = tableType === 'wall' ? 16 : tableType === 'waterfall' ? 4 : 48;

    const shapeSize = 48;
    const cols = 8;
    const rows = Math.ceil(shapeCount / cols);
    const padding = 10;
    const labelH = 14;

    canvas.width = cols * (shapeSize + 4) + padding * 2;
    canvas.height = rows * (shapeSize + labelH + 4) + padding + 30;

    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`${shapeCount} shapes (kind=${selectedKind}, ${tableType}):`, padding, 18);

    for (let s = 0; s < shapeCount; s++) {
      const sid = makeAutotileId(selectedKind, s);
      const info = getTileRenderInfo(sid);
      const col = s % cols;
      const row = Math.floor(s / cols);
      const dx = padding + col * (shapeSize + 4);
      const dy = 28 + row * (shapeSize + labelH + 4);

      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(dx, dy, shapeSize, shapeSize);

      if (info && info.type === 'autotile') {
        const q = info.quarters;
        const hd = shapeSize / 2;
        ctx.imageSmoothingEnabled = false;
        for (let i = 0; i < 4; i++) {
          const img = tilesetImages[q[i].sheet];
          if (img) {
            ctx.drawImage(img, q[i].sx, q[i].sy, HALF, HALF,
              dx + (i % 2) * hd, dy + Math.floor(i / 2) * hd, hd, hd);
          }
        }
      }

      // Draw 3x3 neighbor bitmask overlay
      drawNeighborOverlay(ctx, dx, dy, shapeSize, s, tableType);

      // Shape index label
      ctx.fillStyle = '#888';
      ctx.font = '10px monospace';
      ctx.fillText(`${s}`, dx + 2, dy + shapeSize + 11);
    }
  }, [selectedKind, tilesetImages, drawNeighborOverlay]);

  useEffect(() => {
    if (open && selectedKind !== null) {
      drawSheetSource();
      drawAllShapes();
    }
  }, [open, selectedKind, drawSheetSource, drawAllShapes]);

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
    <div className="db-dialog-overlay" onClick={onClose}>
      <div className="db-dialog" onClick={(e) => e.stopPropagation()}
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
