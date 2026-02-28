import type {
  CustomSceneDef, CustomSceneDefV2, WidgetDef, WidgetDef_Panel,
} from '../../store/uiEditorTypes';

export function isV2Scene(scene: any): boolean {
  return !!(scene.root || (scene.formatVersion && scene.formatVersion >= 2));
}

export function convertLegacyToV2(scene: CustomSceneDef): Partial<CustomSceneDefV2> {
  const children: WidgetDef[] = (scene.windows || []).map((win) => {
    if (win.windowType === 'command') {
      return {
        id: win.id, type: 'list' as const,
        x: win.x, y: win.y,
        width: win.width, height: win.height || undefined,
        maxCols: win.maxCols,
        items: win.commands || [],
        handlers: win.handlers || {},
      };
    } else {
      return {
        id: win.id, type: 'panel' as const,
        x: win.x, y: win.y,
        width: win.width, height: win.height || undefined,
        windowed: true,
        children: [],
      } as WidgetDef_Panel;
    }
  });

  const root: WidgetDef_Panel = {
    id: 'root', type: 'panel',
    x: 0, y: 0, width: 816, height: 624,
    windowed: false,
    children,
  };

  return { root, formatVersion: 2, navigation: { defaultFocus: children[0]?.id } };
}

export function hasDescendantWithId(w: WidgetDef, id: string): boolean {
  return (w.children || []).some((c) => c.id === id || hasDescendantWithId(c, id));
}

/** 드래그 중인 widgetId와 자손 ID 집합을 모듈 레벨 ref로 관리 (컴포넌트 간 공유) */
export const dragState = {
  widgetId: null as string | null,
  /** 드래그 위젯의 모든 자손 ID (순환 참조 방지용) */
  descendantIds: new Set<string>(),
};

/** 위젯 트리에서 id로 위젯 찾기 */
export function findWidgetById(root: WidgetDef, id: string): WidgetDef | null {
  if (root.id === id) return root;
  for (const c of root.children || []) {
    const found = findWidgetById(c, id);
    if (found) return found;
  }
  return null;
}

let _regenCounter = 0;
/** 위젯 트리 전체의 ID를 새로 생성 (붙여넣기 시 ID 충돌 방지) */
export function regenerateWidgetIds(widget: WidgetDef): WidgetDef {
  const newId = `${widget.type}_${Date.now()}${++_regenCounter}`;
  const children = widget.children?.map(regenerateWidgetIds);
  if (children !== undefined) {
    return { ...widget, id: newId, children } as WidgetDef;
  }
  return { ...widget, id: newId } as WidgetDef;
}

/** 시스템 클립보드 위젯 데이터 마커 */
export const WIDGET_CLIPBOARD_MARKER = 'RPGMV_WIDGET_V1';

/** 내부 클립보드 (시스템 클립보드 실패 시 fallback) */
let _widgetClipboard: WidgetDef | null = null;
export function getWidgetClipboard(): WidgetDef | null { return _widgetClipboard; }
export function setWidgetClipboard(w: WidgetDef | null): void { _widgetClipboard = w; }
