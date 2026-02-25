import React, { useCallback } from 'react';
import useEditorStore from '../../store/useEditorStore';
import type { UIWindowInfo, UIElementInfo } from '../../store/types';
import DragLabel from '../common/DragLabel';

export function ElementInspector({ selectedWindow, elem }: {
  selectedWindow: UIWindowInfo;
  elem: UIElementInfo;
}) {
  const uiEditorOverrides = useEditorStore((s) => s.uiEditorOverrides);
  const setUiElementOverride = useEditorStore((s) => s.setUiElementOverride);
  const setUiEditorSelectedElementType = useEditorStore((s) => s.setUiEditorSelectedElementType);

  const elemOv = uiEditorOverrides[selectedWindow.className]?.elements?.[elem.type] ?? {};
  const ex = elemOv.x ?? elem.x;
  const ey = elemOv.y ?? elem.y;
  const ew = elemOv.width ?? elem.width;
  const eh = elemOv.height ?? elem.height;

  const set = useCallback((prop: 'x' | 'y' | 'width' | 'height', value: number) => {
    setUiElementOverride(selectedWindow.className, elem.type, prop, value);
    const iframe = document.getElementById('ui-editor-iframe') as HTMLIFrameElement | null;
    iframe?.contentWindow?.postMessage({
      type: 'updateElementProp',
      windowId: selectedWindow.id,
      elemType: elem.type,
      prop,
      value,
    }, '*');
  }, [selectedWindow, elem.type, setUiElementOverride]);

  return (
    <>
      <div className="ui-editor-inspector-header" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          className="ui-inspector-back-btn"
          onClick={() => setUiEditorSelectedElementType(null)}
          title="창 인스펙터로 돌아가기"
        >←</button>
        <span>{elem.label}</span>
        <span style={{ fontSize: 10, color: '#777', marginLeft: 2 }}>
          ({selectedWindow.className.replace(/^Window_/, '')})
        </span>
      </div>
      <div className="ui-editor-inspector-body">
        <div className="ui-inspector-section">
          <div className="ui-inspector-section-title">위치 / 크기</div>
          <div className="ui-inspector-row">
            <DragLabel label="X" value={ex} onChange={(v) => set('x', Math.round(v))} />
          </div>
          {!elem.isPerActor && (
            <div className="ui-inspector-row">
              <DragLabel label="Y" value={ey} onChange={(v) => set('y', Math.round(v))} />
            </div>
          )}
          {elem.type !== 'actorLevel' && (
            <div className="ui-inspector-row">
              <DragLabel label="너비" value={ew} min={8} onChange={(v) => set('width', Math.round(v))} />
            </div>
          )}
          {elem.type === 'actorFace' && (
            <div className="ui-inspector-row">
              <DragLabel label="높이" value={eh} min={8} onChange={(v) => set('height', Math.round(v))} />
            </div>
          )}
        </div>

        {elem.isPerActor && (
          <div style={{ padding: '2px 12px 6px', fontSize: 11, color: '#777' }}>
            perActor 레이아웃: X/너비만 편집 가능 (Y는 행 순서에 따라 자동)
          </div>
        )}
      </div>
    </>
  );
}
