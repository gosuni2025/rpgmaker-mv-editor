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
  containerWidth = 0,
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

  const scale = containerWidth > 0 ? containerWidth / img.width : 1;
  const cw = Math.round(img.width * scale);
  const ch = Math.round(img.height * scale);
  const ts = TILE_SIZE_PX * scale;

  canvas.width = cw;
  canvas.height = ch;
  drawCheckerboard(ctx, cw, ch, transparentColor, 8 * scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, cw, ch);

  const offset = tabTileOffset[activeTab] ?? 0;

  if (highlight.isDragging && highlight.dragStart && highlight.dragCurrent) {
    const { dragStart: s, dragCurrent: e } = highlight;
    const minCol = Math.min(s.col, e.col), maxCol = Math.max(s.col, e.col);
    const minRow = Math.min(s.row, e.row), maxRow = Math.max(s.row, e.row);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
    const rx = minCol * ts + 1, ry = minRow * ts + 1;
    const rw = (maxCol - minCol + 1) * ts - 2, rh = (maxRow - minRow + 1) * ts - 2;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);
  } else if (selectedTiles && (selectedTilesWidth > 1 || selectedTilesHeight > 1)) {
    const localId = selectedTileId - offset;
    if (localId >= 0 && localId < 256) {
      const cell = localIdToCell(localId);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
      const rx = cell.col * ts + 1, ry = cell.row * ts + 1;
      const rw = selectedTilesWidth * ts - 2, rh = selectedTilesHeight * ts - 2;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
    }
  } else {
    const localId = selectedTileId - offset;
    if (localId >= 0 && localId < 256) {
      const cell = localIdToCell(localId);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(cell.col * ts + 1, cell.row * ts + 1, ts - 2, ts - 2);
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
  containerWidth = 0,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cols = 8;
  const totalEntries = A_TILE_ENTRIES.length;
  const rows = Math.ceil(totalEntries / cols);
  const baseW = cols * TILE_SIZE_PX;
  const baseH = rows * TILE_SIZE_PX;
  const scale = containerWidth > 0 ? containerWidth / baseW : 1;
  const ts = TILE_SIZE_PX * scale;
  const half = HALF * scale;
  const cw = Math.round(baseW * scale);
  const ch = Math.round(baseH * scale);
  canvas.width = cw;
  canvas.height = ch;

  drawCheckerboard(ctx, cw, ch, transparentColor, 8 * scale);
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < totalEntries; i++) {
    const entry = A_TILE_ENTRIES[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const dx = col * ts;
    const dy = row * ts;

    const img = tilesetImages[entry.sheet];
    if (!img) continue;

    const info = getTileRenderInfo(entry.tileId);
    if (!info) continue;

    if (info.type === 'normal') {
      ctx.drawImage(img, info.sx, info.sy, info.sw, info.sh, dx, dy, ts, ts);
    } else {
      const q = info.quarters;
      for (let j = 0; j < 4; j++) {
        const qimg = tilesetImages[q[j].sheet];
        if (!qimg) continue;
        const qdx = dx + (j % 2) * half;
        const qdy = dy + Math.floor(j / 2) * half;
        ctx.drawImage(qimg, q[j].sx, q[j].sy, HALF, HALF, qdx, qdy, half, half);
      }
    }
  }

  if (highlight.isDragging && highlight.dragStart && highlight.dragCurrent) {
    const { dragStart: s, dragCurrent: e } = highlight;
    const minCol = Math.min(s.col, e.col), maxCol = Math.max(s.col, e.col);
    const minRow = Math.min(s.row, e.row), maxRow = Math.max(s.row, e.row);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
    const rx = minCol * ts + 1, ry = minRow * ts + 1;
    const rw = (maxCol - minCol + 1) * ts - 2, rh = (maxRow - minRow + 1) * ts - 2;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);
  } else if (selectedTiles && (selectedTilesWidth > 1 || selectedTilesHeight > 1)) {
    const startIdx = A_TILE_ENTRIES.findIndex(e => e.tileId === selectedTileId);
    if (startIdx >= 0) {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
      const rx = (startIdx % cols) * ts + 1, ry = Math.floor(startIdx / cols) * ts + 1;
      const rw = selectedTilesWidth * ts - 2, rh = selectedTilesHeight * ts - 2;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
    }
  } else {
    for (let i = 0; i < totalEntries; i++) {
      if (selectedTileId === A_TILE_ENTRIES[i].tileId) {
        const sc = i % cols;
        const sr = Math.floor(i / cols);
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(sc * ts + 1, sr * ts + 1, ts - 2, ts - 2);
        break;
      }
    }
  }
}
