import { TILE_ID_A1, TILE_ID_A5 } from './tileHelper';

export interface AutotileEntry {
  kind: number;
  label: string;
  tileId: number;
  category: string;
  sheet: number;
}

export function buildAutotileEntries(includeA5 = false): AutotileEntry[] {
  const entries: AutotileEntry[] = [];
  for (let k = 0; k < 16; k++) {
    entries.push({ sheet: 0, kind: k, label: `A1-${k}`, tileId: TILE_ID_A1 + k * 48 + 46, category: 'A1' });
  }
  for (let k = 16; k < 48; k++) {
    entries.push({ sheet: 1, kind: k, label: `A2-${k - 16}`, tileId: TILE_ID_A1 + k * 48 + 46, category: 'A2' });
  }
  for (let k = 48; k < 80; k++) {
    entries.push({ sheet: 2, kind: k, label: `A3-${k - 48}`, tileId: TILE_ID_A1 + k * 48 + 46, category: 'A3' });
  }
  for (let k = 80; k < 128; k++) {
    entries.push({ sheet: 3, kind: k, label: `A4-${k - 80}`, tileId: TILE_ID_A1 + k * 48 + 46, category: 'A4' });
  }
  if (includeA5) {
    for (let i = 0; i < 128; i++) {
      entries.push({ sheet: 4, kind: -1, label: `A5-${i}`, tileId: TILE_ID_A5 + i, category: 'A5' });
    }
  }
  return entries;
}
