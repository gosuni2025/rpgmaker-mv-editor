import type { TileChange } from '../../store/useEditorStore';

export interface Placement {
  x: number; y: number; z: number; tileId: number;
}

/**
 * Apply a list of tile placements, computing changes (undo entries) and update entries.
 * Returns only the positions that actually changed.
 */
export function computePlacementChanges(
  placements: Placement[],
  mapData: number[],
  width: number,
  height: number,
): { changes: TileChange[]; updates: Placement[] } {
  const changes: TileChange[] = [];
  const updates: Placement[] = [];
  for (const p of placements) {
    const idx = (p.z * height + p.y) * width + p.x;
    const oldId = mapData[idx];
    if (oldId !== p.tileId) {
      changes.push({ x: p.x, y: p.y, z: p.z, oldTileId: oldId, newTileId: p.tileId });
      updates.push(p);
    }
  }
  return { changes, updates };
}

/**
 * Same as above but also updates a mutable data copy (for chained autotile operations).
 * Reads oldId from the mutable `data` array so chained mutations record correct undo values.
 */
export function computePlacementChangesWithData(
  placements: Placement[],
  data: number[],
  width: number,
  height: number,
): { changes: TileChange[]; updates: Placement[] } {
  const changes: TileChange[] = [];
  const updates: Placement[] = [];
  for (const p of placements) {
    const idx = (p.z * height + p.y) * width + p.x;
    const oldId = data[idx];
    if (oldId !== p.tileId) {
      data[idx] = p.tileId;
      changes.push({ x: p.x, y: p.y, z: p.z, oldTileId: oldId, newTileId: p.tileId });
      updates.push(p);
    }
  }
  return { changes, updates };
}
