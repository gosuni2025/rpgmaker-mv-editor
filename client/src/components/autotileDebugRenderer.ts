import {
  getTileRenderInfo, TILE_SIZE_PX, makeAutotileId,
  getAutotileBlockInfo, getShapeNeighbors,
  TILE_ID_A1,
} from '../utils/tileHelper';

const HALF = TILE_SIZE_PX / 2;

/** 3x3 neighbor bitmask overlay 그리기 */
export function drawNeighborOverlay(
  ctx: CanvasRenderingContext2D,
  dx: number, dy: number, cellSize: number,
  shape: number, tableType: 'floor' | 'wall' | 'waterfall'
) {
  const neighbors = getShapeNeighbors(shape, tableType);
  const sub = cellSize / 3;
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(sx, sy, sub, sub);
    }
  }
}

/** 선택된 오토타일 kind의 스프라이트 시트 소스 영역 그리기 */
export function drawSheetSource(
  canvas: HTMLCanvasElement,
  selectedKind: number,
  tilesetImages: Record<number, HTMLImageElement>,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const baseTileId = TILE_ID_A1 + selectedKind * 48;
  const blockInfo = getAutotileBlockInfo(baseTileId);
  if (!blockInfo) return;

  const { setNumber, bx, by, tableType } = blockInfo;
  const img = tilesetImages[setNumber];

  const srcHalfW = 4;
  const srcHalfH = tableType === 'wall' ? 4 : 6;
  const srcPxW = srcHalfW * HALF;
  const srcPxH = srcHalfH * HALF;
  const srcX = bx * 2 * HALF;
  const srcY = by * 2 * HALF;

  const scale = 3;
  const padding = 20;
  const infoHeight = 80;

  canvas.width = srcPxW * scale + padding * 2;
  canvas.height = srcPxH * scale + padding * 2 + infoHeight;

  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#fff';
  ctx.font = '13px monospace';
  ctx.fillText(`kind: ${selectedKind}  sheet: ${setNumber}  type: ${tableType}`, padding, 20);
  ctx.fillText(`bx: ${bx}  by: ${by}`, padding, 38);
  ctx.fillText(`src: (${srcX}, ${srcY}) ${srcPxW}x${srcPxH}px`, padding, 56);

  const drawY = infoHeight;

  // Checkerboard background
  const checkSize = 8;
  for (let cy = 0; cy < srcPxH * scale; cy += checkSize) {
    for (let cx = 0; cx < srcPxW * scale; cx += checkSize) {
      ctx.fillStyle = ((cx / checkSize + cy / checkSize) % 2 === 0) ? '#333' : '#444';
      ctx.fillRect(padding + cx, drawY + padding + cy, checkSize, checkSize);
    }
  }

  if (img) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, srcX, srcY, srcPxW, srcPxH,
      padding, drawY + padding, srcPxW * scale, srcPxH * scale);
  }

  // Half-tile grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= srcHalfW; gx++) {
    const x = padding + gx * HALF * scale;
    ctx.beginPath(); ctx.moveTo(x, drawY + padding); ctx.lineTo(x, drawY + padding + srcPxH * scale); ctx.stroke();
  }
  for (let gy = 0; gy <= srcHalfH; gy++) {
    const y = drawY + padding + gy * HALF * scale;
    ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(padding + srcPxW * scale, y); ctx.stroke();
  }

  // Half-tile coordinate labels
  ctx.fillStyle = '#aaa';
  ctx.font = '10px monospace';
  for (let gy = 0; gy < srcHalfH; gy++) {
    for (let gx = 0; gx < srcHalfW; gx++) {
      ctx.fillText(`${gx},${gy}`, padding + gx * HALF * scale + 2, drawY + padding + gy * HALF * scale + 12);
    }
  }

  // Full-tile grid
  ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
  ctx.lineWidth = 2;
  for (let gx = 0; gx <= srcHalfW / 2; gx++) {
    const x = padding + gx * TILE_SIZE_PX * scale;
    ctx.beginPath(); ctx.moveTo(x, drawY + padding); ctx.lineTo(x, drawY + padding + srcPxH * scale); ctx.stroke();
  }
  for (let gy = 0; gy <= srcHalfH / 2; gy++) {
    const y = drawY + padding + gy * TILE_SIZE_PX * scale;
    ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(padding + srcPxW * scale, y); ctx.stroke();
  }

  // Bitmask overlay
  const halfTileScale = HALF * scale;
  const miniSub = halfTileScale / 3;

  if (tableType === 'floor') {
    // Region 1: unused (X marks)
    for (let gy = 0; gy < 2; gy++) {
      for (let gx = 0; gx < 2; gx++) {
        const hx = padding + gx * halfTileScale;
        const hy = drawY + padding + gy * halfTileScale;
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hx + 2, hy + 2); ctx.lineTo(hx + halfTileScale - 2, hy + halfTileScale - 2);
        ctx.moveTo(hx + halfTileScale - 2, hy + 2); ctx.lineTo(hx + 2, hy + halfTileScale - 2);
        ctx.stroke();
      }
    }

    // Region 2: inner corners
    const region2Grids: Record<string, boolean[][]> = {
      '2,0': [[false, true, true], [true, true, true], [true, true, true]],
      '3,0': [[true, true, false], [true, true, true], [true, true, true]],
      '2,1': [[true, true, true], [true, true, true], [false, true, true]],
      '3,1': [[true, true, true], [true, true, true], [true, true, false]],
    };

    for (const [key, grid] of Object.entries(region2Grids)) {
      const [gx, gy] = key.split(',').map(Number);
      const hx = padding + gx * halfTileScale;
      const hy = drawY + padding + gy * halfTileScale;
      for (let my = 0; my < 3; my++) {
        for (let mx = 0; mx < 3; mx++) {
          const sx = hx + mx * miniSub, sy = hy + my * miniSub;
          if (grid[my][mx]) { ctx.fillStyle = 'rgba(255, 50, 50, 0.5)'; ctx.fillRect(sx, sy, miniSub, miniSub); }
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; ctx.lineWidth = 0.5; ctx.strokeRect(sx, sy, miniSub, miniSub);
        }
      }
    }

    // Region 3: area tiles
    for (let gy = 2; gy < 6; gy++) {
      for (let gx = 0; gx < 4; gx++) {
        const hx = padding + gx * halfTileScale;
        const hy = drawY + padding + gy * halfTileScale;
        const isTopEdge = gy === 2, isBottomEdge = gy === 5, isLeftEdge = gx === 0, isRightEdge = gx === 3;
        const grid: boolean[][] = [
          [!isTopEdge && !isLeftEdge, !isTopEdge, !isTopEdge && !isRightEdge],
          [!isLeftEdge, true, !isRightEdge],
          [!isBottomEdge && !isLeftEdge, !isBottomEdge, !isBottomEdge && !isRightEdge],
        ];
        for (let my = 0; my < 3; my++) {
          for (let mx = 0; mx < 3; mx++) {
            const sx = hx + mx * miniSub, sy = hy + my * miniSub;
            if (grid[my][mx]) { ctx.fillStyle = 'rgba(255, 50, 50, 0.5)'; ctx.fillRect(sx, sy, miniSub, miniSub); }
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; ctx.lineWidth = 0.5; ctx.strokeRect(sx, sy, miniSub, miniSub);
          }
        }
      }
    }

    ctx.fillStyle = 'rgba(255, 100, 100, 0.8)';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('안씀', padding + 4, drawY + padding + halfTileScale + 12);
    ctx.fillText('inner corners', padding + 2 * halfTileScale + 4, drawY + padding + halfTileScale + 12);
    ctx.fillText('area tiles', padding + 4, drawY + padding + 4 * halfTileScale + 12);
  } else if (tableType === 'wall') {
    for (let gy = 0; gy < 4; gy++) {
      for (let gx = 0; gx < 4; gx++) {
        const hx = padding + gx * halfTileScale;
        const hy = drawY + padding + gy * halfTileScale;
        const isTop = gy === 0, isBottom = gy === 3, isLeft = gx === 0, isRight = gx === 3;
        const grid: boolean[][] = [
          [!isTop && !isLeft, !isTop, !isTop && !isRight],
          [!isLeft, true, !isRight],
          [!isBottom && !isLeft, !isBottom, !isBottom && !isRight],
        ];
        for (let my = 0; my < 3; my++) {
          for (let mx = 0; mx < 3; mx++) {
            const sx = hx + mx * miniSub, sy = hy + my * miniSub;
            if (grid[my][mx]) { ctx.fillStyle = 'rgba(255, 50, 50, 0.5)'; ctx.fillRect(sx, sy, miniSub, miniSub); }
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; ctx.lineWidth = 0.5; ctx.strokeRect(sx, sy, miniSub, miniSub);
          }
        }
      }
    }
  }
}

/** 선택된 kind의 전체 48 shape 미리보기 그리기 */
export function drawAllShapes(
  canvas: HTMLCanvasElement,
  selectedKind: number,
  tilesetImages: Record<number, HTMLImageElement>,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

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

    drawNeighborOverlay(ctx, dx, dy, shapeSize, s, tableType);

    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.fillText(`${s}`, dx + 2, dy + shapeSize + 11);
  }
}
