import type { WidgetDef, WidgetDef_Panel } from '../../store/uiEditorTypes';

export const GAME_W = 816;
export const GAME_H = 624;
export type HandleDir = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
export const RESIZE_HANDLES: HandleDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export interface DragState {
  windowId: string;
  className: string;
  handleDir: HandleDir;
  startClientX: number;
  startClientY: number;
  startWin: { x: number; y: number; width: number; height: number };
}

export type WidgetAbsPos = {
  absX: number; absY: number; width: number; height: number;
  parentInnerAbsX: number; parentInnerAbsY: number;
};

export interface WidgetDragState {
  sceneId: string; widgetId: string; handleDir: HandleDir;
  startClientX: number; startClientY: number;
  startRelX: number; startRelY: number; startWidth: number; startHeight: number;
  parentInnerAbsX: number; parentInnerAbsY: number;
}

export function computeAllWidgetPositions(root: WidgetDef_Panel): Map<string, WidgetAbsPos> {
  const res = new Map<string, WidgetAbsPos>();
  function visit(w: WidgetDef, ax: number, ay: number, pix: number, piy: number) {
    res.set(w.id, { absX: ax, absY: ay, width: w.width, height: w.height ?? 36, parentInnerAbsX: pix, parentInnerAbsY: piy });
    if (w.type === 'panel') {
      const p = w as WidgetDef_Panel;
      const pad = p.windowed !== false ? (p.padding ?? 18) : 0;
      for (const c of p.children ?? []) visit(c, ax + pad + c.x, ay + pad + c.y, ax + pad, ay + pad);
    }
  }
  visit(root, root.x, root.y, 0, 0);
  return res;
}

export function flattenWidgetIds(root: WidgetDef_Panel): string[] {
  const ids: string[] = [];
  function visit(w: WidgetDef) {
    ids.push(w.id);
    if (w.type === 'panel') for (const c of (w as WidgetDef_Panel).children ?? []) visit(c);
  }
  visit(root);
  return ids;
}

export function computeUpdates(
  dir: HandleDir,
  dx: number,
  dy: number,
  { x: wx, y: wy, width: ww, height: wh }: { x: number; y: number; width: number; height: number },
): Partial<Record<'x' | 'y' | 'width' | 'height', number>> {
  const updates: Partial<Record<'x' | 'y' | 'width' | 'height', number>> = {};
  if (dir === 'move') {
    updates.x = Math.round(wx + dx);
    updates.y = Math.round(wy + dy);
    return updates;
  }
  if (dir === 'w' || dir === 'nw' || dir === 'sw') {
    const newW = Math.max(32, ww - dx);
    updates.x = Math.round(wx + ww - newW);
    updates.width = Math.round(newW);
  }
  if (dir === 'e' || dir === 'ne' || dir === 'se') {
    updates.width = Math.max(32, Math.round(ww + dx));
  }
  if (dir === 'n' || dir === 'nw' || dir === 'ne') {
    const newH = Math.max(32, wh - dy);
    updates.y = Math.round(wy + wh - newH);
    updates.height = Math.round(newH);
  }
  if (dir === 's' || dir === 'sw' || dir === 'se') {
    updates.height = Math.max(32, Math.round(wh + dy));
  }
  return updates;
}
