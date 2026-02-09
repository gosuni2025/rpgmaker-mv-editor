import type { RPGEvent } from '../types/rpgMakerMV';

const NUM_LAYERS = 6; // z=0~5 (4 tile layers + shadow + region)

/**
 * Resize map data array, preserving existing tile data.
 * @param oldData  - original 1D data array
 * @param oldW     - original width
 * @param oldH     - original height
 * @param newW     - new width
 * @param newH     - new height
 * @param offsetX  - X offset of old data within new map (positive = old data shifts right)
 * @param offsetY  - Y offset of old data within new map (positive = old data shifts down)
 * @returns new data array of size newW * newH * NUM_LAYERS
 */
export function resizeMapData(
  oldData: number[],
  oldW: number, oldH: number,
  newW: number, newH: number,
  offsetX: number, offsetY: number,
): number[] {
  const newData = new Array(newW * newH * NUM_LAYERS).fill(0);

  for (let z = 0; z < NUM_LAYERS; z++) {
    for (let y = 0; y < oldH; y++) {
      for (let x = 0; x < oldW; x++) {
        const nx = x + offsetX;
        const ny = y + offsetY;
        if (nx < 0 || nx >= newW || ny < 0 || ny >= newH) continue;
        const oldIdx = (z * oldH + y) * oldW + x;
        const newIdx = (z * newH + ny) * newW + nx;
        newData[newIdx] = oldData[oldIdx];
      }
    }
  }

  return newData;
}

/**
 * Filter events that fall outside the new map bounds.
 * Adjusts event coordinates by offset.
 */
export function resizeEvents(
  events: (RPGEvent | null)[],
  newW: number, newH: number,
  offsetX: number, offsetY: number,
): (RPGEvent | null)[] {
  return events.map((ev) => {
    if (!ev || ev.id === 0) return ev;
    const nx = ev.x + offsetX;
    const ny = ev.y + offsetY;
    if (nx < 0 || nx >= newW || ny < 0 || ny >= newH) return null;
    return { ...ev, x: nx, y: ny };
  });
}
