// 카메라존 최소 크기 = 화면 타일 수
export const MIN_CZ_W = Math.ceil(816 / 48); // 17
export const MIN_CZ_H = Math.ceil(624 / 48); // 13

export interface ZoneRect {
  x: number; y: number; width: number; height: number;
}

export function detectEdge(
  tile: { x: number; y: number },
  zone: ZoneRect,
): string | null {
  const { x, y, width, height } = zone;
  const onLeft = tile.x === x;
  const onRight = tile.x === x + width - 1;
  const onTop = tile.y === y;
  const onBottom = tile.y === y + height - 1;
  const inH = tile.x >= x && tile.x < x + width;
  const inV = tile.y >= y && tile.y < y + height;

  if (onTop && onLeft) return 'nw';
  if (onTop && onRight) return 'ne';
  if (onBottom && onLeft) return 'sw';
  if (onBottom && onRight) return 'se';
  if (onTop && inH) return 'n';
  if (onBottom && inH) return 's';
  if (onLeft && inV) return 'w';
  if (onRight && inV) return 'e';
  return null;
}

const CURSOR_MAP: Record<string, string> = {
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize',
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
};

export function edgeToCursor(edge: string): string {
  return CURSOR_MAP[edge] || 'default';
}

export function applyResize(
  orig: ZoneRect, edge: string, dx: number, dy: number,
): ZoneRect {
  let nx = orig.x, ny = orig.y, nw = orig.width, nh = orig.height;
  if (edge.includes('w')) { nx = orig.x + dx; nw = orig.width - dx; }
  if (edge.includes('e')) { nw = orig.width + dx; }
  if (edge.includes('n')) { ny = orig.y + dy; nh = orig.height - dy; }
  if (edge.includes('s')) { nh = orig.height + dy; }
  if (nw < MIN_CZ_W) { if (edge.includes('w')) nx = orig.x + orig.width - MIN_CZ_W; nw = MIN_CZ_W; }
  if (nh < MIN_CZ_H) { if (edge.includes('n')) ny = orig.y + orig.height - MIN_CZ_H; nh = MIN_CZ_H; }
  return { x: nx, y: ny, width: nw, height: nh };
}

export function computeCreationRect(
  start: { x: number; y: number }, current: { x: number; y: number },
): ZoneRect {
  const minX = Math.min(start.x, current.x);
  const minY = Math.min(start.y, current.y);
  return {
    x: minX, y: minY,
    width: Math.max(start.x, current.x) - minX + 1,
    height: Math.max(start.y, current.y) - minY + 1,
  };
}
