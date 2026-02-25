export interface FileInfo {
  name: string;
  size: number;
  mtime: number;
  isDir?: boolean;
}

export type SortMode = 'name' | 'size' | 'mtime';

// RPG Maker MV direction: 2=아래, 4=왼쪽, 6=오른쪽, 8=위
// 스프라이트 시트 행 순서: 0=아래(2), 1=왼쪽(4), 2=오른쪽(6), 3=위(8)
export const DIR_FROM_ROW: Record<number, number> = { 0: 2, 1: 4, 2: 6, 3: 8 };
export const ROW_FROM_DIR: Record<number, number> = { 2: 0, 4: 1, 6: 2, 8: 3 };

export function getCharacterSheetInfo(fileName: string) {
  const isSingle = fileName.startsWith('$');
  return {
    charCols: isSingle ? 1 : 4,
    charRows: isSingle ? 1 : 2,
    patterns: 3,
    dirs: 4,
    totalCols: isSingle ? 3 : 12,
    totalRows: isSingle ? 4 : 8,
  };
}

export function getCellCount(type: string): number {
  if (type === 'faces') return 8;
  if (type === 'characters') return 8;
  if (type === 'sv_actors') return 1;
  return 0;
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
  return bytes + ' B';
}
