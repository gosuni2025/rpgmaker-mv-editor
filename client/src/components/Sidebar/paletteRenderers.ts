import {
  TILE_SIZE_PX, getTileRenderInfo,
} from '../../utils/tileHelper';
import { buildAutotileEntries } from '../../utils/autotileEntries';

const HALF = TILE_SIZE_PX / 2;
export const A_TILE_ENTRIES = buildAutotileEntries(true);

export function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  width: number, height: number,
  color: { r: number; g: number; b: number },
  size = 8,
) {
  const { r, g, b } = color;
  const c1 = `rgb(${r}, ${g}, ${b})`;
  const c2 = `rgb(${Math.max(0, r - 48)}, ${Math.max(0, g - 48)}, ${Math.max(0, b - 48)})`;
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? c1 : c2;
      ctx.fillRect(x, y, Math.min(size, width - x), Math.min(size, height - y));
    }
  }
}

/** B-E tile ID → image grid cell (16-col layout) */
export function localIdToCell(localId: number) {
  if (localId < 128) {
    return { col: localId % 8, row: Math.floor(localId / 8) };
  }
  return { col: 8 + (localId - 128) % 8, row: Math.floor((localId - 128) / 8) };
}

interface SelectionHighlightParams {
  ctx: CanvasRenderingContext2D;
  isDragging: boolean;
  dragStart: { col: number; row: number } | null;
  dragCurrent: { col: number; row: number } | null;
}

function drawDragHighlight(ctx: CanvasRenderingContext2D, start: { col: number; row: number }, current: { col: number; row: number }) {
  const minCol = Math.min(start.col, current.col);
  const maxCol = Math.max(start.col, current.col);
  const minRow = Math.min(start.row, current.row);
  const maxRow = Math.max(start.row, current.row);
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
  const rx = minCol * TILE_SIZE_PX + 1;
  const ry = minRow * TILE_SIZE_PX + 1;
  const rw = (maxCol - minCol + 1) * TILE_SIZE_PX - 2;
  const rh = (maxRow - minRow + 1) * TILE_SIZE_PX - 2;
  ctx.fillRect(rx, ry, rw, rh);
  ctx.strokeRect(rx, ry, rw, rh);
}

function drawMultiHighlight(ctx: CanvasRenderingContext2D, startCol: number, startRow: number, w: number, h: number) {
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
  const rx = startCol * TILE_SIZE_PX + 1;
  const ry = startRow * TILE_SIZE_PX + 1;
  const rw = w * TILE_SIZE_PX - 2;
  const rh = h * TILE_SIZE_PX - 2;
  ctx.fillRect(rx, ry, rw, rh);
  ctx.strokeRect(rx, ry, rw, rh);
}

export function renderNormalTab(
  canvas: HTMLCanvasElement,
  activeTab: string,
  tilesetImages: Record<number, HTMLImageElement>,
  tabSheetIndex: Record<string, number[]>,
  tabTileOffset: Record<string, number>,
  selectedTileId: number,
  selectedTiles: number[][] | null,
  selectedTilesWidth: number,
  selectedTilesHeight: number,
  transparentColor: { r: number; g: number; b: number },
  highlight: SelectionHighlightParams,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const sheetIdx = tabSheetIndex[activeTab][0];
  const img = tilesetImages[sheetIdx];

  if (!img) {
    canvas.width = 256;
    canvas.height = 100;
    drawCheckerboard(ctx, canvas.width, canvas.height, transparentColor);
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No tileset', canvas.width / 2, 50);
    return;
  }

  canvas.width = img.width;
  canvas.height = img.height;
  drawCheckerboard(ctx, canvas.width, canvas.height, transparentColor);
  ctx.drawImage(img, 0, 0);

  const offset = tabTileOffset[activeTab] ?? 0;

  if (highlight.isDragging && highlight.dragStart && highlight.dragCurrent) {
    drawDragHighlight(ctx, highlight.dragStart, highlight.dragCurrent);
  } else if (selectedTiles && (selectedTilesWidth > 1 || selectedTilesHeight > 1)) {
    const localId = selectedTileId - offset;
    if (localId >= 0 && localId < 256) {
      const cell = localIdToCell(localId);
      drawMultiHighlight(ctx, cell.col, cell.row, selectedTilesWidth, selectedTilesHeight);
    }
  } else {
    const localId = selectedTileId - offset;
    if (localId >= 0 && localId < 256) {
      const cell = localIdToCell(localId);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(cell.col * TILE_SIZE_PX + 1, cell.row * TILE_SIZE_PX + 1, TILE_SIZE_PX - 2, TILE_SIZE_PX - 2);
    }
  }
}

export function renderATab(
  canvas: HTMLCanvasElement,
  tilesetImages: Record<number, HTMLImageElement>,
  selectedTileId: number,
  selectedTiles: number[][] | null,
  selectedTilesWidth: number,
  selectedTilesHeight: number,
  transparentColor: { r: number; g: number; b: number },
  highlight: SelectionHighlightParams,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cols = 8;
  const totalEntries = A_TILE_ENTRIES.length;
  const rows = Math.ceil(totalEntries / cols);
  const cw = cols * TILE_SIZE_PX;
  const ch = rows * TILE_SIZE_PX;
  canvas.width = cw;
  canvas.height = ch;

  drawCheckerboard(ctx, cw, ch, transparentColor);

  for (let i = 0; i < totalEntries; i++) {
    const entry = A_TILE_ENTRIES[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const dx = col * TILE_SIZE_PX;
    const dy = row * TILE_SIZE_PX;

    const img = tilesetImages[entry.sheet];
    if (!img) continue;

    const info = getTileRenderInfo(entry.tileId);
    if (!info) continue;

    if (info.type === 'normal') {
      ctx.drawImage(img, info.sx, info.sy, info.sw, info.sh, dx, dy, TILE_SIZE_PX, TILE_SIZE_PX);
    } else {
      const q = info.quarters;
      for (let j = 0; j < 4; j++) {
        const qimg = tilesetImages[q[j].sheet];
        if (!qimg) continue;
        const qdx = dx + (j % 2) * HALF;
        const qdy = dy + Math.floor(j / 2) * HALF;
        ctx.drawImage(qimg, q[j].sx, q[j].sy, HALF, HALF, qdx, qdy, HALF, HALF);
      }
    }
  }

  if (highlight.isDragging && highlight.dragStart && highlight.dragCurrent) {
    drawDragHighlight(ctx, highlight.dragStart, highlight.dragCurrent);
  } else if (selectedTiles && (selectedTilesWidth > 1 || selectedTilesHeight > 1)) {
    const startIdx = A_TILE_ENTRIES.findIndex(e => e.tileId === selectedTileId);
    if (startIdx >= 0) {
      drawMultiHighlight(ctx, startIdx % cols, Math.floor(startIdx / cols), selectedTilesWidth, selectedTilesHeight);
    }
  } else {
    for (let i = 0; i < totalEntries; i++) {
      if (selectedTileId === A_TILE_ENTRIES[i].tileId) {
        const sc = i % cols;
        const sr = Math.floor(i / cols);
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(sc * TILE_SIZE_PX + 1, sr * TILE_SIZE_PX + 1, TILE_SIZE_PX - 2, TILE_SIZE_PX - 2);
        break;
      }
    }
  }
}
