/**
 * WidgetDef 트리 조작 순수 함수들.
 * uiEditorSlice의 각 액션에서 인라인으로 정의되던 재귀 helper들을 분리.
 */
import type { WidgetDef } from './uiEditorTypes';

/** 특정 부모에 위젯 추가 */
export function wtAdd(root: WidgetDef, parentId: string, def: WidgetDef): WidgetDef {
  if (root.id === parentId) {
    return { ...root, children: [...(root.children || []), def] };
  }
  if (!root.children?.length) return root;
  return { ...root, children: root.children.map(w => wtAdd(w, parentId, def)) };
}

/** 특정 ID 위젯 제거 */
export function wtRemove(root: WidgetDef, id: string): WidgetDef | null {
  if (root.id === id) return null;
  if (!root.children?.length) return root;
  return { ...root, children: root.children.map(w => wtRemove(w, id)).filter(Boolean) as WidgetDef[] };
}

/** 특정 ID 위젯 필드 업데이트 */
export function wtUpdate(root: WidgetDef, id: string, updates: Partial<WidgetDef>): WidgetDef {
  if (root.id === id) {
    const merged = { ...root, ...updates } as WidgetDef & { nativeDefault?: boolean };
    const POSITION_KEYS = ['x', 'y', 'width', 'height'];
    if (POSITION_KEYS.some(k => k in updates)) delete merged.nativeDefault;
    return merged as WidgetDef;
  }
  if (!root.children?.length) return root;
  return { ...root, children: root.children.map(w => wtUpdate(w, id, updates)) };
}

/** 특정 ID 위젯을 자식까지 함께 이동 */
export function wtMove(root: WidgetDef, id: string, x: number, y: number): WidgetDef {
  function applyDelta(widget: WidgetDef, dx: number, dy: number): WidgetDef {
    const moved = { ...widget, x: widget.x + dx, y: widget.y + dy };
    if (!moved.children?.length) return moved;
    return { ...moved, children: moved.children.map(c => applyDelta(c, dx, dy)) };
  }
  if (root.id === id) {
    const moved = applyDelta(root, x - root.x, y - root.y) as WidgetDef & { nativeDefault?: boolean };
    delete moved.nativeDefault;
    return moved as WidgetDef;
  }
  if (!root.children?.length) return root;
  return { ...root, children: root.children.map(w => wtMove(w, id, x, y)) };
}

/** 드래그로 위젯 재정렬 */
export function wtReorder(root: WidgetDef, dragId: string, targetId: string, position: 'before' | 'inside'): WidgetDef {
  let dragged: WidgetDef | null = null;

  function extract(widget: WidgetDef): WidgetDef {
    if (!widget.children?.length) return widget;
    const idx = widget.children.findIndex(c => c.id === dragId);
    if (idx >= 0) {
      dragged = widget.children[idx];
      return { ...widget, children: widget.children.filter((_, i) => i !== idx) };
    }
    return { ...widget, children: widget.children.map(extract) };
  }

  const afterExtract = extract(root);
  if (!dragged) return root;

  function insert(widget: WidgetDef): WidgetDef {
    const ch = widget.children || [];
    if (position === 'inside' && widget.id === targetId) {
      return { ...widget, children: [...ch, dragged!] };
    }
    const idx = ch.findIndex(c => c.id === targetId);
    if (idx >= 0 && position === 'before') {
      const next = [...ch];
      next.splice(idx, 0, dragged!);
      return { ...widget, children: next };
    }
    if (!ch.length) return widget;
    return { ...widget, children: ch.map(insert) };
  }

  return insert(afterExtract);
}

/** 위젯 ID 변경 (nav 참조 포함) */
export function wtRename(root: WidgetDef, oldId: string, newId: string): WidgetDef {
  const NAV_KEYS = ['navUp', 'navDown', 'navLeft', 'navRight'] as const;
  function rename(widget: WidgetDef): WidgetDef {
    const updated: any = { ...widget };
    if (updated.id === oldId) updated.id = newId;
    NAV_KEYS.forEach(k => { if (updated[k] === oldId) updated[k] = newId; });
    if (updated.children?.length) updated.children = updated.children.map(rename);
    return updated as WidgetDef;
  }
  return rename(root);
}

/** 위젯 복제 (바로 뒤에 삽입), 클론된 ID 반환 */
export function wtDuplicate(root: WidgetDef, widgetId: string): { root: WidgetDef; clonedId: string | null } {
  const suffix = '_' + Date.now().toString(36).slice(-4);
  let cloned: WidgetDef | null = null;

  function cloneWidget(widget: WidgetDef): WidgetDef {
    const c: any = { ...widget, id: widget.id + suffix };
    if (c.children?.length) c.children = c.children.map(cloneWidget);
    return c as WidgetDef;
  }

  function insertAfter(widget: WidgetDef): WidgetDef {
    if (!widget.children?.length) return widget;
    const idx = widget.children.findIndex(c => c.id === widgetId);
    if (idx >= 0) {
      cloned = cloneWidget({ ...widget.children[idx], x: widget.children[idx].x + 10, y: widget.children[idx].y + 10 });
      return { ...widget, children: [...widget.children.slice(0, idx + 1), cloned, ...widget.children.slice(idx + 1)] };
    }
    return { ...widget, children: widget.children.map(insertAfter) };
  }

  const newRoot = insertAfter(root);
  return { root: newRoot, clonedId: cloned ? (cloned as WidgetDef).id : null };
}
