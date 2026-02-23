export interface ClipboardData {
  type: 'tiles' | 'event' | 'events' | 'lights' | 'objects' | 'passage';
  tiles?: { x: number; y: number; z: number; tileId: number }[];
  width?: number;
  height?: number;
  event?: unknown;
  events?: unknown[];
  npcData?: Record<number, { name: string; showName: boolean }>;
  lights?: unknown[];
  objects?: unknown[];
  passage?: { x: number; y: number; value: number }[];
}
