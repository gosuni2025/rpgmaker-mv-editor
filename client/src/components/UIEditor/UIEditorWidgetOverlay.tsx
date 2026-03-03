import React from 'react';
import { RESIZE_HANDLES, type HandleDir, type WidgetAbsPos, type WidgetDragState } from './UIEditorCanvasUtils';
import type { WidgetDef } from '../../store/uiEditorTypes';

interface UIEditorWidgetOverlayProps {
  customSceneId: string;
  widgetOrderedIds: string[];
  widgetPositions: Map<string, WidgetAbsPos>;
  widgetById: Map<string, WidgetDef>;
  customSceneSelectedWidget: string | null;
  setCustomSceneSelectedWidget: (id: string | null) => void;
  pushCustomSceneUndo: () => void;
  setWidgetDragState: (state: WidgetDragState | null) => void;
}

export default function UIEditorWidgetOverlay({
  customSceneId,
  widgetOrderedIds,
  widgetPositions,
  widgetById,
  customSceneSelectedWidget,
  setCustomSceneSelectedWidget,
  pushCustomSceneUndo,
  setWidgetDragState,
}: UIEditorWidgetOverlayProps) {
  // 선택된 위젯을 마지막에 렌더링 → DOM 상단에 위치, 리사이즈 핸들 가시 + 클릭 우선처리
  const ids = widgetOrderedIds.filter(id => id !== 'root');
  const sortedIds = customSceneSelectedWidget
    ? [...ids.filter(id => id !== customSceneSelectedWidget), customSceneSelectedWidget]
    : ids;

  return (
    <>
      {sortedIds.map(id => {
        const pos = widgetPositions.get(id);
        if (!pos) return null;
        if (widgetById.get(id)?.previewSelectable === false) return null;
        const isSel = id === customSceneSelectedWidget;
        return (
          <div
            key={id}
            className={`ui-overlay-widget${isSel ? ' selected' : ''}`}
            style={{ left: pos.absX, top: pos.absY, width: pos.width, height: pos.height }}
            onMouseDown={(e) => {
              e.stopPropagation();
              setCustomSceneSelectedWidget(id);
              pushCustomSceneUndo();
              setWidgetDragState({
                sceneId: customSceneId,
                widgetId: id,
                handleDir: 'move',
                startClientX: e.clientX,
                startClientY: e.clientY,
                startRelX: pos.absX - pos.parentInnerAbsX,
                startRelY: pos.absY - pos.parentInnerAbsY,
                startWidth: pos.width,
                startHeight: pos.height,
                parentInnerAbsX: pos.parentInnerAbsX,
                parentInnerAbsY: pos.parentInnerAbsY,
              });
            }}
          >
            {isSel && <div className="ui-overlay-label">{id}</div>}
            {isSel && RESIZE_HANDLES.map((dir: HandleDir) => (
              <div
                key={dir}
                className={`ui-resize-handle handle-${dir}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  pushCustomSceneUndo();
                  setWidgetDragState({
                    sceneId: customSceneId,
                    widgetId: id,
                    handleDir: dir,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startRelX: pos.absX - pos.parentInnerAbsX,
                    startRelY: pos.absY - pos.parentInnerAbsY,
                    startWidth: pos.width,
                    startHeight: pos.height,
                    parentInnerAbsX: pos.parentInnerAbsX,
                    parentInnerAbsY: pos.parentInnerAbsY,
                  });
                }}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}
