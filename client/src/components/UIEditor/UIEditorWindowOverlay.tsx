import React from 'react';
import type { UIWindowInfo } from '../../store/types';
import { RESIZE_HANDLES, type HandleDir } from './UIEditorCanvasUtils';

interface UIEditorWindowOverlayProps {
  uiEditorWindows: UIWindowInfo[];
  uiEditorSelectedWindowId: string | null;
  uiEditorOverrides: Record<string, any>;
  uiEditorSelectedElementType: string | null;
  handleWindowMouseDown: (e: React.MouseEvent, win: UIWindowInfo) => void;
  handleResizeMouseDown: (e: React.MouseEvent, win: UIWindowInfo, dir: HandleDir) => void;
  setUiEditorSelectedElementType: (type: string | null) => void;
}

export default function UIEditorWindowOverlay({
  uiEditorWindows,
  uiEditorSelectedWindowId,
  uiEditorOverrides,
  uiEditorSelectedElementType,
  handleWindowMouseDown,
  handleResizeMouseDown,
  setUiEditorSelectedElementType,
}: UIEditorWindowOverlayProps) {
  return (
    <>
      {uiEditorWindows.map((win) => {
        const isSelected = win.id === uiEditorSelectedWindowId;
        const windowOverride = uiEditorOverrides[win.className];
        const padding = win.padding ?? 18;
        const elements = win.elements ?? [];

        return (
          <div
            key={win.id}
            className={`ui-overlay-window${isSelected ? ' selected' : ''}`}
            style={{ left: win.x, top: win.y, width: win.width, height: win.height }}
            title={win.className}
            onMouseDown={(e) => handleWindowMouseDown(e, win)}
          >
            {isSelected && (
              <div className="ui-overlay-label">
                {win.className.replace(/^Window_/, '')}
              </div>
            )}
            {isSelected && RESIZE_HANDLES.map((dir: HandleDir) => (
              <div
                key={dir}
                className={`ui-resize-handle handle-${dir}`}
                onMouseDown={(e) => handleResizeMouseDown(e, win, dir)}
              />
            ))}

            {/* 요소 오버레이 (창 선택 시 표시) */}
            {isSelected && elements.map((elem) => {
              const elemOv = windowOverride?.elements?.[elem.type] ?? {};
              const ex = elemOv.x ?? elem.x;
              const ey = elemOv.y ?? elem.y;
              const ew = elemOv.width ?? elem.width;
              const eh = elemOv.height ?? elem.height;
              const isElemSelected = uiEditorSelectedElementType === elem.type;
              const isElemHidden = elemOv.visible === false;
              return (
                <div
                  key={elem.type}
                  className={`ui-overlay-element${isElemSelected ? ' selected' : ''}${isElemHidden ? ' hidden' : ''}`}
                  style={{
                    left: padding + ex,
                    top: padding + ey,
                    width: ew,
                    height: eh,
                  }}
                  title={isElemHidden ? `${elem.label} (숨김)` : elem.label}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setUiEditorSelectedElementType(isElemSelected ? null : elem.type);
                  }}
                >
                  <div className="ui-overlay-element-label">
                    {isElemHidden ? '🚫 ' : ''}{elem.label}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
