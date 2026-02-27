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
